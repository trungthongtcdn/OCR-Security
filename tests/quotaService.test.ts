import { beforeEach, describe, expect, it } from "vitest";
import { ensureCompanyConfig, openDatabase, type DB } from "../src/db/database.js";
import { CompanyRepo } from "../src/db/companyRepo.js";
import { EmployeeRepo } from "../src/db/employeeRepo.js";
import { UsageRepo } from "../src/db/usageRepo.js";
import { QuotaService } from "../src/quota/quotaService.js";

describe("QuotaService", () => {
  let db: DB;
  let quotaService: QuotaService;
  let employeeRepo: EmployeeRepo;

  beforeEach(() => {
    db = openDatabase(":memory:");
    ensureCompanyConfig(db, 5);
    employeeRepo = new EmployeeRepo(db);
    quotaService = new QuotaService(
      employeeRepo,
      new UsageRepo(db),
      new CompanyRepo(db),
      () => 3, // default employee monthly quota
    );
  });

  it("registers a new employee with default quota on first contact", () => {
    const emp = quotaService.registerOrGetEmployee("zalo-1", "Nguyen Van A");
    expect(emp.monthlyQuota).toBe(3);
    expect(emp.active).toBe(true);
  });

  it("returns the same employee on repeated registration", () => {
    const first = quotaService.registerOrGetEmployee("zalo-1", "Nguyen Van A");
    const second = quotaService.registerOrGetEmployee("zalo-1", "Nguyen Van A (renamed ignored)");
    expect(second.id).toBe(first.id);
    expect(second.name).toBe("Nguyen Van A");
  });

  it("allows OCR while under both employee and company quota", () => {
    const emp = quotaService.registerOrGetEmployee("zalo-1", "A");
    const result = quotaService.checkBeforeOcr(emp);
    expect(result.allowed).toBe(true);
    expect(result.status.employeeRemaining).toBe(3);
    expect(result.status.companyRemaining).toBe(5);
  });

  it("blocks OCR once employee monthly quota is exhausted", () => {
    const emp = quotaService.registerOrGetEmployee("zalo-1", "A");
    quotaService.consumeOnSuccess(emp, "vehicle_registration");
    quotaService.consumeOnSuccess(emp, "vehicle_registration");
    quotaService.consumeOnSuccess(emp, "vehicle_registration");

    const result = quotaService.checkBeforeOcr(emp);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("employee_quota_exceeded");
    expect(result.status.employeeRemaining).toBe(0);
  });

  it("blocks OCR once company-wide monthly quota is exhausted even if employee has quota left", () => {
    employeeRepo.setMonthlyQuota("zalo-1", 100);
    const empA = quotaService.registerOrGetEmployee("zalo-1", "A");
    const empB = quotaService.registerOrGetEmployee("zalo-2", "B");

    for (let i = 0; i < 5; i++) {
      quotaService.consumeOnSuccess(empB, "insurance");
    }

    const result = quotaService.checkBeforeOcr(empA);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("company_quota_exceeded");
  });

  it("blocks inactive employees regardless of remaining quota", () => {
    const emp = quotaService.registerOrGetEmployee("zalo-1", "A");
    employeeRepo.setActive("zalo-1", false);
    const inactiveEmp = employeeRepo.findByZaloId("zalo-1")!;

    const result = quotaService.checkBeforeOcr(inactiveEmp);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("employee_inactive");
    void emp;
  });

  it("does not deduct quota on failed OCR attempts", () => {
    const emp = quotaService.registerOrGetEmployee("zalo-1", "A");
    quotaService.recordFailure(emp, "vehicle_registration", "gemini timeout");
    const status = quotaService.getStatus(emp);
    expect(status.employeeUsed).toBe(0);
    expect(status.employeeRemaining).toBe(3);
  });

  it("formats a human-readable Vietnamese status message", () => {
    const emp = quotaService.registerOrGetEmployee("zalo-1", "Nguyen Van A");
    quotaService.consumeOnSuccess(emp, "vehicle_registration");
    const status = quotaService.getStatus(emp);
    const msg = quotaService.formatStatusMessage(status);
    expect(msg).toContain("Nguyen Van A");
    expect(msg).toContain("da dung 1/3");
  });
});
