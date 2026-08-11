import type { Employee } from "../db/employeeRepo.js";
import { logger } from "../logger.js";
import type { GeminiOcrClient, ImageInput } from "../ocr/geminiClient.js";
import type { QuotaService } from "../quota/quotaService.js";
import type { GoogleSheetsClient } from "../sheets/googleSheetsClient.js";
import {
  INSURANCE_HEADER,
  LICENSE_HEADER,
  toInsuranceRow,
  toLicenseRow,
} from "../sheets/rowMapper.js";

export interface PipelineConfig {
  tabLicense: string;
  tabInsurance: string;
}

export interface PipelineResult {
  ok: boolean;
  message: string;
}

export class OcrPipeline {
  private tabsEnsured = false;

  constructor(
    private readonly gemini: GeminiOcrClient,
    private readonly sheets: GoogleSheetsClient,
    private readonly quotaService: QuotaService,
    private readonly config: PipelineConfig,
  ) {}

  private async ensureTabs(): Promise<void> {
    if (this.tabsEnsured) return;
    await this.sheets.ensureTabWithHeader(this.config.tabLicense, LICENSE_HEADER);
    await this.sheets.ensureTabWithHeader(this.config.tabInsurance, INSURANCE_HEADER);
    this.tabsEnsured = true;
  }

  async processImage(employee: Employee, image: ImageInput): Promise<PipelineResult> {
    const check = this.quotaService.checkBeforeOcr(employee);
    if (!check.allowed) {
      return { ok: false, message: this.blockedMessage(check.reason, check.status) };
    }

    let extraction;
    try {
      extraction = await this.gemini.extract(image);
    } catch (err) {
      logger.error({ err, employeeId: employee.id }, "loi khi goi Gemini OCR");
      this.quotaService.recordFailure(employee, "unknown", String(err));
      return {
        ok: false,
        message: "Xin loi, he thong OCR gap loi khi doc anh. Vui long thu lai sau it phut.",
      };
    }

    if (extraction.documentType === "unknown") {
      this.quotaService.recordFailure(employee, "unknown", "unrecognized_document");
      return {
        ok: false,
        message:
          "Khong nhan dien duoc day la GPLX hay giay bao hiem xe. Vui long gui lai anh ro net hon.",
      };
    }

    const meta = {
      timestamp: new Date().toISOString(),
      employeeName: employee.name,
      employeeZaloId: employee.zaloId,
    };

    try {
      await this.ensureTabs();
      if (extraction.documentType === "driver_license") {
        const row = toLicenseRow(extraction, meta);
        if (row) await this.sheets.appendRow(this.config.tabLicense, row);
      } else {
        const row = toInsuranceRow(extraction, meta);
        if (row) await this.sheets.appendRow(this.config.tabInsurance, row);
      }
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
    extraction: Awaited<ReturnType<GeminiOcrClient["extract"]>>,
    status: ReturnType<QuotaService["getStatus"]>,
  ): string {
    const lines: string[] = [];
    if (extraction.documentType === "driver_license" && extraction.driverLicense) {
      const f = extraction.driverLicense;
      lines.push("Da doc xong Giay phep lai xe:");
      lines.push(`- Ho ten: ${f.fullName || "?"}`);
      lines.push(`- Ngay sinh: ${f.dateOfBirth || "?"}`);
      lines.push(`- So GPLX: ${f.licenseNumber || "?"}`);
      lines.push(`- Hang: ${f.licenseClass || "?"}`);
      lines.push(`- Ngay het han: ${f.expiryDate || "?"}`);
    } else if (extraction.documentType === "insurance" && extraction.insurance) {
      const f = extraction.insurance;
      lines.push("Da doc xong Giay chung nhan bao hiem xe:");
      lines.push(`- Chu xe: ${f.ownerName || "?"}`);
      lines.push(`- Bien so: ${f.vehiclePlate || "?"}`);
      lines.push(`- Cong ty bao hiem: ${f.insuranceCompany || "?"}`);
      lines.push(`- Hieu luc den: ${f.expiryDate || "?"}`);
    }
    if (extraction.lowConfidenceFields.length > 0) {
      lines.push(`(Luu y: kiem tra lai thu cong cac truong: ${extraction.lowConfidenceFields.join(", ")})`);
    }
    lines.push("Da luu vao Google Sheet.");
    lines.push(
      `Han muc thang ${status.month}: con ${status.employeeRemaining}/${status.employeeQuota} luot cua ban.`,
    );
    return lines.join("\n");
  }
}
