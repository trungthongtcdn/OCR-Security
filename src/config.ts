import "dotenv/config";
import path from "node:path";

function required(name: string, value: string | undefined): string {
  if (!value || value.trim() === "") {
    throw new Error(`Thieu bien moi truong bat buoc: ${name}`);
  }
  return value;
}

function int(name: string, value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) throw new Error(`Bien moi truong ${name} phai la so nguyen`);
  return n;
}

export interface AppConfig {
  gemini: {
    apiKey: string;
    model: string;
  };
  sheets: {
    serviceAccountFile: string;
    sheetId: string;
    tabLicense: string;
    tabInsurance: string;
  };
  zalo: {
    sessionDir: string;
  };
  db: {
    file: string;
  };
  quota: {
    companyMonthlyQuota: number;
    defaultEmployeeMonthlyQuota: number;
  };
  adminZaloIds: Set<string>;
  logLevel: string;
}

export function loadConfig(): AppConfig {
  return {
    gemini: {
      apiKey: required("GEMINI_API_KEY", process.env.GEMINI_API_KEY),
      model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
    },
    sheets: {
      serviceAccountFile: path.resolve(
        process.env.GOOGLE_SERVICE_ACCOUNT_FILE ?? "./credentials/service-account.json",
      ),
      sheetId: required("GOOGLE_SHEET_ID", process.env.GOOGLE_SHEET_ID),
      tabLicense: process.env.GOOGLE_SHEET_TAB_LICENSE ?? "GPLX",
      tabInsurance: process.env.GOOGLE_SHEET_TAB_INSURANCE ?? "BaoHiem",
    },
    zalo: {
      sessionDir: path.resolve(process.env.ZALO_SESSION_DIR ?? "./zalo-session"),
    },
    db: {
      file: path.resolve(process.env.DATABASE_FILE ?? "./data/ocr-security.sqlite3"),
    },
    quota: {
      companyMonthlyQuota: int("COMPANY_MONTHLY_QUOTA", process.env.COMPANY_MONTHLY_QUOTA, 1000),
      defaultEmployeeMonthlyQuota: int(
        "DEFAULT_EMPLOYEE_MONTHLY_QUOTA",
        process.env.DEFAULT_EMPLOYEE_MONTHLY_QUOTA,
        50,
      ),
    },
    adminZaloIds: new Set(
      (process.env.ADMIN_ZALO_IDS ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
    logLevel: process.env.LOG_LEVEL ?? "info",
  };
}
