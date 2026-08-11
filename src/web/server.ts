import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express, { type Express, type NextFunction, type Request, type Response } from "express";
import type { CompanyRepo } from "../db/companyRepo.js";
import { type EmployeeRepo, type EmployeeUpdate } from "../db/employeeRepo.js";
import type { SettingsRepo } from "../db/settingsRepo.js";
import { currentMonthKey, type UsageRepo } from "../db/usageRepo.js";
import { logger } from "../logger.js";
import type { ZaloSessionManager } from "../zalo/zaloSession.js";

export interface WebServerDeps {
  employeeRepo: EmployeeRepo;
  usageRepo: UsageRepo;
  companyRepo: CompanyRepo;
  settingsRepo: SettingsRepo;
  zaloSession: ZaloSessionManager;
  adminUser: string;
  adminPassword: string;
}

function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function basicAuthMiddleware(user: string, pass: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization ?? "";
    if (header.startsWith("Basic ")) {
      const decoded = Buffer.from(header.slice(6), "base64").toString("utf-8");
      const sep = decoded.indexOf(":");
      if (sep !== -1) {
        const reqUser = decoded.slice(0, sep);
        const reqPass = decoded.slice(sep + 1);
        if (timingSafeEqualStr(reqUser, user) && timingSafeEqualStr(reqPass, pass)) {
          next();
          return;
        }
      }
    }
    res.set("WWW-Authenticate", 'Basic realm="OCR-Security Admin"');
    res.status(401).send("Yeu cau dang nhap");
  };
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function createWebServer(deps: WebServerDeps): Express {
  const { employeeRepo, usageRepo, companyRepo, settingsRepo, zaloSession } = deps;
  const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../public");

  const app = express();
  app.use(express.json({ limit: "2mb" }));
  app.use(basicAuthMiddleware(deps.adminUser, deps.adminPassword));
  app.use(express.static(publicDir));

  app.get("/api/status", (_req, res) => {
    res.json({
      zalo: zaloSession.getStatus(),
      ocrConfigured: settingsRepo.isOcrConfigured(),
    });
  });

  app.post("/api/zalo/login", (_req, res) => {
    zaloSession.startQrLogin().catch((err) => logger.error({ err }, "loi khi bat dau dang nhap Zalo"));
    res.status(202).json({ ok: true });
  });

  app.post("/api/zalo/logout", (_req, res) => {
    zaloSession.logout();
    res.json({ ok: true });
  });

  app.get("/api/settings", (_req, res) => {
    res.json({
      geminiApiKeySet: Boolean(settingsRepo.getGeminiApiKey()),
      geminiModel: settingsRepo.getGeminiModel(),
      googleSheetId: settingsRepo.getGoogleSheetId() ?? "",
      googleServiceAccountSet: Boolean(settingsRepo.getGoogleServiceAccountJsonRaw()),
      googleServiceAccountEmail: settingsRepo.getGoogleServiceAccountCredentials()?.client_email ?? "",
      sheetTabLicense: settingsRepo.getSheetTabLicense(),
      sheetTabInsurance: settingsRepo.getSheetTabInsurance(),
      companyMonthlyQuota: companyRepo.getMonthlyQuota(),
      defaultEmployeeMonthlyQuota: settingsRepo.getDefaultEmployeeMonthlyQuota(),
    });
  });

  app.put("/api/settings", (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    try {
      if (typeof body.geminiApiKey === "string" && body.geminiApiKey.trim()) {
        settingsRepo.setGeminiApiKey(body.geminiApiKey.trim());
      }
      if (typeof body.geminiModel === "string" && body.geminiModel.trim()) {
        settingsRepo.setGeminiModel(body.geminiModel.trim());
      }
      if (typeof body.googleSheetId === "string" && body.googleSheetId.trim()) {
        settingsRepo.setGoogleSheetId(body.googleSheetId.trim());
      }
      if (typeof body.googleServiceAccountJson === "string" && body.googleServiceAccountJson.trim()) {
        const parsed = JSON.parse(body.googleServiceAccountJson) as Record<string, unknown>;
        if (!parsed.client_email || !parsed.private_key) {
          throw new Error("File JSON service account thieu client_email/private_key");
        }
        settingsRepo.setGoogleServiceAccountJsonRaw(body.googleServiceAccountJson.trim());
      }
      if (typeof body.sheetTabLicense === "string" && body.sheetTabLicense.trim()) {
        settingsRepo.setSheetTabLicense(body.sheetTabLicense.trim());
      }
      if (typeof body.sheetTabInsurance === "string" && body.sheetTabInsurance.trim()) {
        settingsRepo.setSheetTabInsurance(body.sheetTabInsurance.trim());
      }
      if (typeof body.companyMonthlyQuota === "number" && Number.isFinite(body.companyMonthlyQuota)) {
        companyRepo.setMonthlyQuota(Math.max(0, Math.trunc(body.companyMonthlyQuota)));
      }
      if (
        typeof body.defaultEmployeeMonthlyQuota === "number" &&
        Number.isFinite(body.defaultEmployeeMonthlyQuota)
      ) {
        settingsRepo.setDefaultEmployeeMonthlyQuota(
          Math.max(0, Math.trunc(body.defaultEmployeeMonthlyQuota)),
        );
      }
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ ok: false, error: errorMessage(err) });
    }
  });

  app.get("/api/employees", (_req, res) => {
    const month = currentMonthKey();
    const employees = employeeRepo.listAll().map((emp) => {
      const used = usageRepo.countSuccessForEmployeeInMonth(emp.id, month);
      return {
        id: emp.id,
        zaloId: emp.zaloId,
        name: emp.name,
        monthlyQuota: emp.monthlyQuota,
        used,
        remaining: Math.max(0, emp.monthlyQuota - used),
        active: emp.active,
        isAdmin: emp.isAdmin,
      };
    });
    res.json({ month, employees });
  });

  app.post("/api/employees", (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const zaloId = typeof body.zaloId === "string" ? body.zaloId.trim() : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!zaloId || !name) {
      res.status(400).json({ ok: false, error: "Thieu zaloId hoac name" });
      return;
    }
    const monthlyQuota =
      typeof body.monthlyQuota === "number" && Number.isFinite(body.monthlyQuota)
        ? Math.max(0, Math.trunc(body.monthlyQuota))
        : settingsRepo.getDefaultEmployeeMonthlyQuota();
    const employee = employeeRepo.upsertManual({
      zaloId,
      name,
      monthlyQuota,
      isAdmin: Boolean(body.isAdmin),
    });
    res.status(201).json({ ok: true, employee });
  });

  app.put("/api/employees/:id", (req, res) => {
    const id = Number.parseInt(req.params.id ?? "", 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ ok: false, error: "id khong hop le" });
      return;
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const update: EmployeeUpdate = {};
    if (typeof body.name === "string" && body.name.trim()) update.name = body.name.trim();
    if (typeof body.monthlyQuota === "number" && Number.isFinite(body.monthlyQuota)) {
      update.monthlyQuota = Math.max(0, Math.trunc(body.monthlyQuota));
    }
    if (typeof body.active === "boolean") update.active = body.active;
    if (typeof body.isAdmin === "boolean") update.isAdmin = body.isAdmin;

    const employee = employeeRepo.updateById(id, update);
    if (!employee) {
      res.status(404).json({ ok: false, error: "Khong tim thay NVKD" });
      return;
    }
    res.json({ ok: true, employee });
  });

  app.get("/api/usage", (req, res) => {
    const parsedLimit = Number.parseInt(String(req.query.limit ?? "50"), 10);
    const limit = Math.min(200, Math.max(1, Number.isNaN(parsedLimit) ? 50 : parsedLimit));
    res.json({ logs: usageRepo.listRecent(limit) });
  });

  return app;
}
