import { loadConfig } from "./config.js";
import { CompanyRepo } from "./db/companyRepo.js";
import { ensureCompanyConfig, openDatabase } from "./db/database.js";
import { EmployeeRepo } from "./db/employeeRepo.js";
import { UsageRepo } from "./db/usageRepo.js";
import { logger } from "./logger.js";
import { GeminiOcrClient } from "./ocr/geminiClient.js";
import { OcrPipeline } from "./pipeline/ocrPipeline.js";
import { QuotaService } from "./quota/quotaService.js";
import { GoogleSheetsClient } from "./sheets/googleSheetsClient.js";
import { MessageRouter } from "./zalo/messageRouter.js";
import { ZaloClient } from "./zalo/zaloClient.js";

async function main(): Promise<void> {
  const config = loadConfig();

  const db = openDatabase(config.db.file);
  ensureCompanyConfig(db, config.quota.companyMonthlyQuota);

  const employeeRepo = new EmployeeRepo(db);
  const usageRepo = new UsageRepo(db);
  const companyRepo = new CompanyRepo(db);
  const quotaService = new QuotaService(
    employeeRepo,
    usageRepo,
    companyRepo,
    config.quota.defaultEmployeeMonthlyQuota,
  );

  const gemini = new GeminiOcrClient(config.gemini.apiKey, config.gemini.model);
  const sheets = new GoogleSheetsClient(config.sheets.serviceAccountFile, config.sheets.sheetId);
  const ocrPipeline = new OcrPipeline(gemini, sheets, quotaService, {
    tabLicense: config.sheets.tabLicense,
    tabInsurance: config.sheets.tabInsurance,
  });

  const zaloClient = new ZaloClient(config.zalo.sessionDir);
  await zaloClient.login();

  const router = new MessageRouter(
    zaloClient,
    quotaService,
    employeeRepo,
    companyRepo,
    ocrPipeline,
    config.adminZaloIds,
  );

  zaloClient.onMessage((message) => router.handle(message));
  zaloClient.start();

  logger.info("OCR-Security da san sang, dang lang nghe tin nhan Zalo...");
}

main().catch((err) => {
  logger.error({ err }, "khong khoi dong duoc ung dung");
  process.exit(1);
});
