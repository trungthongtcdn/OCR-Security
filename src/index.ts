import { loadConfig } from "./config.js";
import { CompanyRepo } from "./db/companyRepo.js";
import { ensureCompanyConfig, openDatabase } from "./db/database.js";
import { EmployeeRepo } from "./db/employeeRepo.js";
import { SettingsRepo } from "./db/settingsRepo.js";
import { UsageRepo } from "./db/usageRepo.js";
import { logger } from "./logger.js";
import { QuotaService } from "./quota/quotaService.js";
import { ServiceRegistry } from "./runtime/serviceRegistry.js";
import { createWebServer } from "./web/server.js";
import { MessageRouter } from "./zalo/messageRouter.js";
import { ZaloSessionManager } from "./zalo/zaloSession.js";

async function main(): Promise<void> {
  const config = loadConfig();

  const db = openDatabase(config.db.file);
  ensureCompanyConfig(db, 1000);

  const employeeRepo = new EmployeeRepo(db);
  const usageRepo = new UsageRepo(db);
  const companyRepo = new CompanyRepo(db);
  const settingsRepo = new SettingsRepo(db);

  const quotaService = new QuotaService(employeeRepo, usageRepo, companyRepo, () =>
    settingsRepo.getDefaultEmployeeMonthlyQuota(),
  );
  const serviceRegistry = new ServiceRegistry(settingsRepo, quotaService);

  const zaloSession = new ZaloSessionManager(config.zalo.sessionDir);
  const router = new MessageRouter(
    zaloSession,
    quotaService,
    employeeRepo,
    companyRepo,
    serviceRegistry,
  );

  zaloSession.on("logged_in", () => {
    zaloSession.onMessage((message) => router.handle(message));
    zaloSession.start();
    logger.info("Zalo da ket noi, bat dau lang nghe tin nhan");
  });

  const resumed = await zaloSession.tryResumeSession();
  logger.info({ resumed }, "khoi tao ket noi Zalo tu session da luu");

  const app = createWebServer({
    employeeRepo,
    usageRepo,
    companyRepo,
    settingsRepo,
    zaloSession,
    adminUser: config.web.adminUser,
    adminPassword: config.web.adminPassword,
  });

  app.listen(config.web.port, () => {
    logger.info(
      { port: config.web.port },
      `Trang Admin: http://localhost:${config.web.port} (dang nhap bang ADMIN_PANEL_USER/ADMIN_PANEL_PASSWORD)`,
    );
  });
}

main().catch((err) => {
  logger.error({ err }, "khong khoi dong duoc ung dung");
  process.exit(1);
});
