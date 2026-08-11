import type { Employee } from "../db/employeeRepo.js";
import { logger } from "../logger.js";
import type { GeminiOcrClient, ImageInput } from "../ocr/geminiClient.js";
import type { ExtractionResult, VehicleFields } from "../ocr/types.js";
import type { VisionOcrClient } from "../ocr/visionClient.js";
import { findLabeledValue, normalizeCode } from "../ocr/visionCrossCheck.js";
import type { QuotaService } from "../quota/quotaService.js";
import type { GoogleSheetsClient } from "../sheets/googleSheetsClient.js";
import { DOC_TYPE_LABEL, VEHICLE_HEADER, toVehicleRow } from "../sheets/rowMapper.js";

export interface PipelineConfig {
  tab: string;
}

/** Nhan (tieng Viet, khong dau) dung de tim gia tri tren van ban tho cua Cloud Vision. */
const CROSS_CHECK_FIELDS: Array<{ field: "chassisNumber" | "engineNumber"; label: string; labelKeywords: string[] }> = [
  { field: "chassisNumber", label: "So khung", labelKeywords: ["SO KHUNG"] },
  { field: "engineNumber", label: "So may", labelKeywords: ["SO MAY"] },
];

export interface PipelineResult {
  ok: boolean;
  /** true = anh khong phai giay dang ky xe/bao hiem xe, bo qua hoan toan, KHONG tra loi NVKD. */
  silent?: boolean;
  message: string;
}

export class OcrPipeline {
  private tabEnsured = false;

  constructor(
    private readonly gemini: GeminiOcrClient,
    /** Model manh nhat, dung de doc lai khi lan dau co truong do tin cay thap (chu viet tay). */
    private readonly premiumGemini: GeminiOcrClient,
    /** Y kien thu 2 (Google Cloud Vision) doi chieu so khung/so may - undefined neu Admin chua bat tinh nang nay. */
    private readonly visionClient: VisionOcrClient | undefined,
    private readonly sheets: GoogleSheetsClient,
    private readonly quotaService: QuotaService,
    private readonly config: PipelineConfig,
  ) {}

  private async ensureTab(): Promise<void> {
    if (this.tabEnsured) return;
    await this.sheets.ensureTabWithHeader(this.config.tab, VEHICLE_HEADER);
    this.tabEnsured = true;
  }

  async processImage(employee: Employee, image: ImageInput): Promise<PipelineResult> {
    const check = this.quotaService.checkBeforeOcr(employee);
    if (!check.allowed) {
      return { ok: false, message: this.blockedMessage(check.reason, check.status) };
    }

    let extraction: ExtractionResult;
    try {
      extraction = await this.readImage(image, employee.id);
    } catch (err) {
      logger.error({ err, employeeId: employee.id }, "loi khi goi Gemini OCR");
      this.quotaService.recordFailure(employee, "unknown", String(err));
      return {
        ok: false,
        message: "Xin loi, he thong OCR gap loi khi doc anh. Vui long thu lai sau it phut.",
      };
    }

    if (extraction.documentType === "unknown") {
      logger.debug(
        { employeeId: employee.id },
        "anh khong phai giay dang ky xe/bao hiem xe, bo qua khong tra loi",
      );
      return { ok: false, silent: true, message: "" };
    }

    await this.ensureTab();
    const meta = {
      timestamp: new Date().toISOString(),
      employeeName: employee.name,
      employeeZaloId: employee.zaloId,
    };

    try {
      const row = toVehicleRow(extraction, meta);
      if (row) await this.sheets.appendRow(this.config.tab, row);
    } catch (err) {
      logger.error({ err, employeeId: employee.id }, "loi khi ghi Google Sheet");
      this.quotaService.recordFailure(employee, extraction.documentType, String(err));
      return {
        ok: false,
        message: "Doc anh thanh cong nhung luu vao Google Sheet bi loi. Vui long bao Admin kiem tra.",
      };
    }

    const status = this.quotaService.consumeOnSuccess(employee, extraction.documentType);
    return {
      ok: true,
      message: this.successMessage(extraction, status),
    };
  }

  /**
   * Doc anh bang Gemini (+ tu dong doc lai bang model manh hon neu co truong do tin cay thap).
   * Dung chung cho ca luong xu ly that qua Zalo (processImage, co tru han muc/ghi sheet) va
   * tinh nang "Test OCR" trong trang Admin (chi doc thu, khong tru han muc/khong ghi sheet).
   */
  async readImage(image: ImageInput, context: number | string = "test"): Promise<ExtractionResult> {
    const extraction = await this.gemini.extract(image);
    if (extraction.documentType === "unknown") return extraction;
    const afterRetry = await this.retryWithPremiumIfLowConfidence(extraction, image, context);
    return this.crossCheckWithVision(afterRetry, image, context);
  }

  /**
   * Neu lan doc dau tien co truong do tin cay thap (thuong do chu viet tay), tu dong doc lai
   * bang model manh nhat hien co va giu ket qua nao it truong nghi ngo hon. Bo qua neu model
   * dang dung da la model manh nhat (tranh goi API 2 lan khong can thiet).
   */
  private async retryWithPremiumIfLowConfidence(
    extraction: ExtractionResult,
    image: ImageInput,
    context: number | string,
  ): Promise<ExtractionResult> {
    if (extraction.lowConfidenceFields.length === 0) return extraction;
    if (this.gemini === this.premiumGemini) return extraction;

    try {
      const retry = await this.premiumGemini.extract(image);
      if (retry.documentType !== "unknown" && retry.lowConfidenceFields.length < extraction.lowConfidenceFields.length) {
        logger.info(
          { context, before: extraction.lowConfidenceFields.length, after: retry.lowConfidenceFields.length },
          "doc lai bang model manh hon do chu viet tay, ket qua tot hon",
        );
        return retry;
      }
      return extraction;
    } catch (err) {
      logger.warn({ err, context }, "loi khi doc lai bang model manh hon, dung ket qua ban dau");
      return extraction;
    }
  }

  /**
   * Doi chieu cheo so khung/so may voi Google Cloud Vision - day la ma IN/DAP (khong phai chu
   * viet tay) nen 1 engine OCR khac co the giup phat hien khi Gemini doc SAI ma "tu tin" (khong
   * tu danh dau lowConfidenceFields). Neu Cloud Vision doc khac Gemini, danh dau truong do can
   * kiem tra thu cong va ghi lai ca 2 ket qua de NVKD doi chieu. Bo qua hoan toan (khong loi) neu
   * chua bat tinh nang nay hoac Cloud Vision goi loi - day la buoc tang cuong, khong bat buoc.
   */
  private async crossCheckWithVision(
    extraction: ExtractionResult,
    image: ImageInput,
    context: number | string,
  ): Promise<ExtractionResult> {
    if (!this.visionClient || !extraction.vehicle) return extraction;

    let visionText: string;
    try {
      visionText = await this.visionClient.detectText(image);
    } catch (err) {
      logger.warn({ err, context }, "loi khi goi Cloud Vision doi chieu, bo qua buoc nay");
      return extraction;
    }
    if (!visionText) return extraction;

    const vehicle = extraction.vehicle;
    let lowConfidenceFields = extraction.lowConfidenceFields;
    const notes: string[] = [];

    for (const { field, label, labelKeywords } of CROSS_CHECK_FIELDS) {
      const geminiValue = vehicle[field];
      if (!geminiValue) continue;
      const visionValue = findLabeledValue(visionText, labelKeywords);
      if (!visionValue) continue;
      if (normalizeCode(geminiValue) === normalizeCode(visionValue)) continue;

      if (!lowConfidenceFields.includes(field)) {
        lowConfidenceFields = [...lowConfidenceFields, field];
      }
      notes.push(`${label}: Gemini doc "${geminiValue}", Cloud Vision doc "${visionValue}"`);
    }

    if (notes.length === 0) return extraction;
    logger.info({ context, notes }, "Cloud Vision doi chieu phat hien khac biet voi Gemini");
    return { ...extraction, lowConfidenceFields, crossCheckNotes: notes };
  }

  private blockedMessage(
    reason: string | undefined,
    status: ReturnType<QuotaService["getStatus"]>,
  ): string {
    if (reason === "employee_inactive") {
      return "Tai khoan cua ban dang bi tam khoa OCR. Vui long lien he Admin.";
    }
    if (reason === "company_quota_exceeded") {
      return `Cong ty da het han muc OCR thang ${status.month} (${status.companyUsed}/${status.companyQuota}). Vui long lien he Admin.`;
    }
    return `Ban da het han muc OCR ca nhan thang ${status.month} (${status.employeeUsed}/${status.employeeQuota}). Vui long lien he Admin de duoc cap them.`;
  }

  private successMessage(
    extraction: ExtractionResult,
    status: ReturnType<QuotaService["getStatus"]>,
  ): string {
    const f: VehicleFields = extraction.vehicle ?? {
      vehiclePlate: "",
      vehicleType: "",
      seatCount: "",
      ownerName: "",
      address: "",
      chassisNumber: "",
      engineNumber: "",
      loadCapacity: "",
    };
    const label = DOC_TYPE_LABEL[extraction.documentType];
    const lines = [
      `Da doc xong ${label}:`,
      `- Bien so xe: ${f.vehiclePlate || "?"}`,
      `- Loai xe: ${f.vehicleType || "?"}`,
      `- So cho ngoi: ${f.seatCount || "?"}`,
      `- Ho ten chu xe: ${f.ownerName || "?"}`,
      `- Dia chi: ${f.address || "?"}`,
      `- So khung: ${f.chassisNumber || "?"}`,
      `- So may: ${f.engineNumber || "?"}`,
      `- Tai trong: ${f.loadCapacity || "?"}`,
    ];
    if (extraction.lowConfidenceFields.length > 0) {
      lines.push(`(Luu y: kiem tra lai thu cong cac truong: ${extraction.lowConfidenceFields.join(", ")})`);
    }
    if (extraction.crossCheckNotes && extraction.crossCheckNotes.length > 0) {
      lines.push("(Doi chieu Cloud Vision phat hien khac biet, kiem tra lai ban goc:)");
      for (const note of extraction.crossCheckNotes) {
        lines.push(`  - ${note}`);
      }
    }
    lines.push("(*) So khung/So may la ma so quan trong, luon doi chieu lai voi ban goc truoc khi dung lam ho so chinh thuc.");
    lines.push("Da luu vao Google Sheet.");
    lines.push(
      `Han muc thang ${status.month}: con ${status.employeeRemaining}/${status.employeeQuota} luot cua ban.`,
    );
    return lines.join("\n");
  }
}
