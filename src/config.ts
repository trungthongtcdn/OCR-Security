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

/**
 * Chi chua cau hinh ha tang (khong doi luc chay). Cau hinh nghiep vu (Gemini, Google
 * Sheets, han muc, danh sach Admin) duoc quan ly qua trang web Admin va luu trong DB
 * (xem src/db/settingsRepo.ts), khong con nam trong .env.
 */
export interface AppConfig {
  db: { file: string };
  zalo: { sessionDir: string };
  web: { port: number; adminUser: string; adminPassword: string };
  logLevel: string;
}

export function loadConfig(): AppConfig {
  return {
    db: {
      file: path.resolve(process.env.DATABASE_FILE ?? "./data/ocr-security.sqlite3"),
    },
    zalo: {
      sessionDir: path.resolve(process.env.ZALO_SESSION_DIR ?? "./zalo-session"),
    },
    web: {
      port: int("PORT", process.env.PORT, 4000),
      adminUser: process.env.ADMIN_PANEL_USER ?? "admin",
      adminPassword: required("ADMIN_PANEL_PASSWORD", process.env.ADMIN_PANEL_PASSWORD),
    },
    logLevel: process.env.LOG_LEVEL ?? "info",
  };
}
