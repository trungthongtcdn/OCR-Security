import { ThreadType, type Message } from "zca-js";
import type { Employee, EmployeeRepo } from "../db/employeeRepo.js";
import type { GroupCandidateRepo } from "../db/groupCandidateRepo.js";
import { logger } from "../logger.js";
import type { ServiceRegistry } from "../runtime/serviceRegistry.js";
import type { QuotaService } from "../quota/quotaService.js";
import type { CompanyRepo } from "../db/companyRepo.js";
import { extractImageUrl, getTextContent } from "./attachment.js";
import { parseCommand } from "./commandParser.js";
import type { ZaloSessionManager } from "./zaloSession.js";

export class MessageRouter {
  constructor(
    private readonly zaloSession: ZaloSessionManager,
    private readonly quotaService: QuotaService,
    private readonly employeeRepo: EmployeeRepo,
    private readonly companyRepo: CompanyRepo,
    private readonly serviceRegistry: ServiceRegistry,
    private readonly groupCandidateRepo: GroupCandidateRepo,
  ) {}

  async handle(message: Message): Promise<void> {
    if (message.isSelf) return; // bo qua tin nhan do chinh tai khoan Admin gui (tranh vong lap)

    const imageUrl = extractImageUrl(message);

    if (message.type === ThreadType.Group) {
      // Nhom: chi xu ly anh, va chi khi Admin da chon dang ky nhom nay lam "NVKD" tu trang Admin -
      // khong tu dong nhan bat ky nhom nao tai khoan Admin dang tham gia (tranh spam/tra loi nham).
      // Nhung van ghi nhan MOI tin nhan (ke ca van ban, ke ca nhom chua duoc them) vao
      // GroupCandidateRepo, de nhom moi tu xuat hien trong trang Admin ngay tu lan nhan tin dau
      // tien - Admin khong can dong bo/tai lai danh sach nhom thu cong.
      // Chua ho tro lenh van ban trong nhom (vd "han muc") vi can gan lenh do voi thanh vien hay
      // ca nhom, ngoai pham vi tinh nang nay.
      await this.recordGroupCandidate(message.threadId);
      if (imageUrl) await this.handleGroupImage(message, imageUrl);
      return;
    }
    if (message.type !== ThreadType.User) return;

    const senderId = message.data.uidFrom;
    const senderName = message.data.dName || senderId;
    const isAdmin = this.employeeRepo.isAdmin(senderId);

    if (imageUrl) {
      const employee = this.quotaService.registerOrGetEmployee(senderId, senderName);
      await this.processImage(employee, message, imageUrl, senderId);
      return;
    }

    const text = getTextContent(message);
    if (text) {
      await this.handleText(message, senderId, senderName, text, isAdmin);
    }
  }

  /** Neu nhom da biet, chi cham last_seen_at (khong goi API). Neu la nhom moi, lay ten qua Zalo 1 lan. */
  private async recordGroupCandidate(groupId: string): Promise<void> {
    if (this.groupCandidateRepo.touch(groupId)) return;
    const info = await this.zaloSession.getGroupInfo(groupId);
    if (info) this.groupCandidateRepo.upsert(groupId, info.name, info.totalMember);
  }

  private async handleGroupImage(message: Message, imageUrl: string): Promise<void> {
    const group = this.employeeRepo.findByZaloId(message.threadId);
    if (!group?.isGroup) return; // nhom chua duoc Admin them -> bo qua hoan toan, khong tra loi
    await this.processImage(group, message, imageUrl, message.threadId);
  }

  private async processImage(
    employee: Employee,
    message: Message,
    imageUrl: string,
    contextId: string,
  ): Promise<void> {
    let reply: string | undefined;
    try {
      const pipeline = this.serviceRegistry.getPipeline();
      const { buffer, mimeType } = await this.zaloSession.downloadImage(imageUrl);
      const result = await pipeline.processImage(employee, {
        base64Data: buffer.toString("base64"),
        mimeType,
      });
      // silent = anh khong phai giay dang ky xe/bao hiem xe -> bo qua, khong tra loi
      reply = result.silent ? undefined : result.message;
    } catch (err) {
      logger.error({ err, contextId }, "loi khi xu ly anh tu Zalo");
      reply = err instanceof Error && err.message.includes("chua duoc cau hinh")
        ? "He thong OCR chua duoc cau hinh xong. Vui long lien he Admin."
        : "Xin loi, khong tai duoc anh vua gui. Vui long thu gui lai.";
    }

    if (reply) {
      await this.zaloSession.reply(message.threadId, message.type, reply);
    }
  }

  private async handleText(
    message: Message,
    senderId: string,
    senderName: string,
    text: string,
    isAdmin: boolean,
  ): Promise<void> {
    const command = parseCommand(text, isAdmin);
    const reply = this.executeCommand(command, senderId, senderName);
    if (reply) {
      await this.zaloSession.reply(message.threadId, message.type, reply);
    }
  }

  private executeCommand(
    command: ReturnType<typeof parseCommand>,
    senderId: string,
    senderName: string,
  ): string | undefined {
    switch (command.kind) {
      case "help":
        return this.helpMessage(this.employeeRepo.isAdmin(senderId));

      case "check_own_quota": {
        const employee = this.quotaService.registerOrGetEmployee(senderId, senderName);
        return this.quotaService.formatStatusMessage(this.quotaService.getStatus(employee));
      }

      case "check_company_quota": {
        const status = this.quotaService.getStatus(
          this.quotaService.registerOrGetEmployee(senderId, senderName),
        );
        return `Han muc toan cong ty thang ${status.month}: da dung ${status.companyUsed}/${status.companyQuota} (con ${status.companyRemaining}).`;
      }

      case "list_all_quota":
        return this.listAllQuotaMessage();

      case "check_employee_quota": {
        const target = this.employeeRepo.findByZaloId(command.target) ??
          this.employeeRepo.findByNameLike(command.target)[0];
        if (!target) return `Khong tim thay NVKD "${command.target}".`;
        return this.quotaService.formatStatusMessage(this.quotaService.getStatus(target));
      }

      case "set_employee_quota": {
        const target = this.employeeRepo.findByZaloId(command.target) ??
          this.employeeRepo.findByNameLike(command.target)[0];
        if (!target) return `Khong tim thay NVKD "${command.target}".`;
        this.employeeRepo.setMonthlyQuota(target.zaloId, command.quota);
        return `Da cap han muc ${command.quota} luot/thang cho ${target.name}.`;
      }

      case "set_company_quota":
        this.companyRepo.setMonthlyQuota(command.quota);
        return `Da cap han muc cong ty: ${command.quota} luot/thang.`;

      case "set_employee_active": {
        const target = this.employeeRepo.findByZaloId(command.target) ??
          this.employeeRepo.findByNameLike(command.target)[0];
        if (!target) return `Khong tim thay NVKD "${command.target}".`;
        this.employeeRepo.setActive(target.zaloId, command.active);
        return `Da ${command.active ? "kich hoat" : "tam khoa"} OCR cho ${target.name}.`;
      }

      case "unknown":
      default:
        return undefined;
    }
  }

  private listAllQuotaMessage(): string {
    const employees = this.employeeRepo.listAll();
    if (employees.length === 0) return "Chua co NVKD nao dang ky OCR.";
    const lines = employees.map((emp) => {
      const status = this.quotaService.getStatus(emp);
      return `- ${emp.name}${emp.active ? "" : " (da khoa)"}: ${status.employeeUsed}/${status.employeeQuota}`;
    });
    return ["Han muc tat ca NVKD thang nay:", ...lines].join("\n");
  }

  private helpMessage(isAdmin: boolean): string {
    const lines = [
      "Cac lenh ho tro:",
      "- 'han muc' hoac /quota: xem han muc OCR con lai cua ban",
      "- Gui anh Giay dang ky xe (ca vet) hoac Giay chung nhan bao hiem xe de OCR tu dong",
    ];
    if (isAdmin) {
      lines.push(
        "Lenh danh cho Admin:",
        "- /quota all: xem han muc tat ca NVKD",
        "- /quota <ten NVKD>: xem han muc cua 1 NVKD",
        "- han muc cong ty: xem han muc toan cong ty",
        "- /setquota <ten NVKD> <so luot>: cap han muc cho NVKD",
        "- /setcompanyquota <so luot>: cap han muc toan cong ty",
        "- /active <ten NVKD> on|off: bat/tat quyen OCR cua NVKD",
      );
    }
    return lines.join("\n");
  }
}
