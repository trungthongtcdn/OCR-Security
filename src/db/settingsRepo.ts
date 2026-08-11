import { PREMIUM_GEMINI_MODEL } from "../ocr/geminiClient.js";
import type { DB } from "./database.js";

export interface ServiceAccountCredentials {
  client_email: string;
  private_key: string;
  [key: string]: unknown;
}

/** Cac model Gemini da bi Google ngung phuc vu - neu DB dang luu gia tri nay thi coi nhu chua cau hinh, tu dong dung model mac dinh moi. */
const RETIRED_GEMINI_MODELS = new Set([
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-2.0-flash",
  "gemini-2.0-flash-001",
  "gemini-2.0-flash-lite",
  "gemini-2.0-flash-lite-001",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
]);

const KEYS = {
  geminiApiKey: "gemini_api_key",
  geminiModel: "gemini_model",
  googleSheetId: "google_sheet_id",
  googleServiceAccountJson: "google_service_account_json",
  sheetTab: "sheet_tab",
  defaultEmployeeMonthlyQuota: "default_employee_monthly_quota",
} as const;

/** Cau hinh nghiep vu co the thay doi qua trang Admin (khong can restart hay sua .env). */
export class SettingsRepo {
  constructor(private readonly db: DB) {}

  private get(key: string): string | undefined {
    const row = this.db
      .prepare<[string], { value: string }>("SELECT value FROM settings WHERE key = ?")
      .get(key);
    return row?.value;
  }

  private set(key: string, value: string): void {
    this.db
      .prepare(
        "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      )
      .run(key, value);
  }

  getGeminiApiKey(): string | undefined {
    return this.get(KEYS.geminiApiKey);
  }
  setGeminiApiKey(value: string): void {
    this.set(KEYS.geminiApiKey, value);
  }

  getGeminiModel(): string {
    const stored = this.get(KEYS.geminiModel);
    if (!stored || RETIRED_GEMINI_MODELS.has(stored)) return PREMIUM_GEMINI_MODEL;
    return stored;
  }
  setGeminiModel(value: string): void {
    this.set(KEYS.geminiModel, value);
  }

  getGoogleSheetId(): string | undefined {
    return this.get(KEYS.googleSheetId);
  }
  setGoogleSheetId(value: string): void {
    this.set(KEYS.googleSheetId, value);
  }

  getGoogleServiceAccountJsonRaw(): string | undefined {
    return this.get(KEYS.googleServiceAccountJson);
  }
  setGoogleServiceAccountJsonRaw(value: string): void {
    this.set(KEYS.googleServiceAccountJson, value);
  }
  getGoogleServiceAccountCredentials(): ServiceAccountCredentials | undefined {
    const raw = this.getGoogleServiceAccountJsonRaw();
    if (!raw) return undefined;
    return JSON.parse(raw) as ServiceAccountCredentials;
  }

  getSheetTab(): string {
    return this.get(KEYS.sheetTab) ?? "DuLieuXe";
  }
  setSheetTab(value: string): void {
    this.set(KEYS.sheetTab, value);
  }

  getDefaultEmployeeMonthlyQuota(): number {
    const raw = this.get(KEYS.defaultEmployeeMonthlyQuota);
    return raw ? Number.parseInt(raw, 10) : 50;
  }
  setDefaultEmployeeMonthlyQuota(value: number): void {
    this.set(KEYS.defaultEmployeeMonthlyQuota, String(value));
  }

  isOcrConfigured(): boolean {
    return Boolean(
      this.getGeminiApiKey() && this.getGoogleSheetId() && this.getGoogleServiceAccountJsonRaw(),
    );
  }
}
