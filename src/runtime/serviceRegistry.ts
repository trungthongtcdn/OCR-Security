import type { SettingsRepo } from "../db/settingsRepo.js";
import { GeminiOcrClient } from "../ocr/geminiClient.js";
import { OcrPipeline } from "../pipeline/ocrPipeline.js";
import type { QuotaService } from "../quota/quotaService.js";
import { GoogleSheetsClient } from "../sheets/googleSheetsClient.js";

/**
 * Xay dung (va cache) GeminiOcrClient / GoogleSheetsClient / OcrPipeline tu cau hinh
 * hien tai trong SettingsRepo. Cau hinh co the doi bat cu luc nao qua trang Admin, nen
 * moi lan getPipeline() se so sanh "chu ky" cau hinh va tu dong dung lai instance cu
 * (neu khong doi) hoac tao moi (neu Admin vua luu cau hinh khac).
 */
export class ServiceRegistry {
  private cachedSignature: string | undefined;
  private cachedPipeline: OcrPipeline | undefined;

  constructor(
    private readonly settingsRepo: SettingsRepo,
    private readonly quotaService: QuotaService,
  ) {}

  isConfigured(): boolean {
    return this.settingsRepo.isOcrConfigured();
  }

  private signature(): string {
    return JSON.stringify([
      this.settingsRepo.getGeminiApiKey(),
      this.settingsRepo.getGeminiModel(),
      this.settingsRepo.getGoogleSheetId(),
      this.settingsRepo.getGoogleServiceAccountJsonRaw(),
      this.settingsRepo.getSheetTabLicense(),
      this.settingsRepo.getSheetTabInsurance(),
    ]);
  }

  getPipeline(): OcrPipeline {
    if (!this.isConfigured()) {
      throw new Error(
        "He thong chua duoc cau hinh du Gemini API key / Google Sheet. Vui long vao trang Admin de cau hinh.",
      );
    }

    const signature = this.signature();
    if (this.cachedPipeline && this.cachedSignature === signature) {
      return this.cachedPipeline;
    }

    const gemini = new GeminiOcrClient(
      this.settingsRepo.getGeminiApiKey()!,
      this.settingsRepo.getGeminiModel(),
    );
    const sheets = new GoogleSheetsClient(
      this.settingsRepo.getGoogleServiceAccountCredentials()!,
      this.settingsRepo.getGoogleSheetId()!,
    );
    const pipeline = new OcrPipeline(gemini, sheets, this.quotaService, {
      tabLicense: this.settingsRepo.getSheetTabLicense(),
      tabInsurance: this.settingsRepo.getSheetTabInsurance(),
    });

    this.cachedSignature = signature;
    this.cachedPipeline = pipeline;
    return pipeline;
  }
}
