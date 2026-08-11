import type { CompanyRepo } from "../db/companyRepo.js";
import type { Employee, EmployeeRepo } from "../db/employeeRepo.js";
import { currentMonthKey, type DocType, type UsageRepo } from "../db/usageRepo.js";

export interface QuotaStatus {
  employee: Employee;
  month: string;
  employeeUsed: number;
  employeeRemaining: number;
  employeeQuota: number;
  companyUsed: number;
  companyRemaining: number;
  companyQuota: number;
}

export interface QuotaCheckResult {
  allowed: boolean;
  reason?: "employee_quota_exceeded" | "company_quota_exceeded" | "employee_inactive";
  status: QuotaStatus;
}

export class QuotaService {
  constructor(
    private readonly employeeRepo: EmployeeRepo,
    private readonly usageRepo: UsageRepo,
    private readonly companyRepo: CompanyRepo,
    private readonly getDefaultEmployeeMonthlyQuota: () => number,
    private readonly now: () => Date = () => new Date(),
  ) {}

  registerOrGetEmployee(zaloId: string, name: string): Employee {
    return this.employeeRepo.getOrCreate(zaloId, name, this.getDefaultEmployeeMonthlyQuota());
  }

  getStatus(employee: Employee): QuotaStatus {
    const month = currentMonthKey(this.now());
    const employeeUsed = this.usageRepo.countSuccessForEmployeeInMonth(employee.id, month);
    const companyUsed = this.usageRepo.countSuccessCompanyInMonth(month);
    const companyQuota = this.companyRepo.getMonthlyQuota();
    return {
      employee,
      month,
      employeeUsed,
      employeeRemaining: Math.max(0, employee.monthlyQuota - employeeUsed),
      employeeQuota: employee.monthlyQuota,
      companyUsed,
      companyRemaining: Math.max(0, companyQuota - companyUsed),
      companyQuota,
    };
  }

  /** Kiem tra con han muc truoc khi goi OCR (khong tru han muc). */
  checkBeforeOcr(employee: Employee): QuotaCheckResult {
    const status = this.getStatus(employee);
    if (!employee.active) {
      return { allowed: false, reason: "employee_inactive", status };
    }
    if (status.companyRemaining <= 0) {
      return { allowed: false, reason: "company_quota_exceeded", status };
    }
    if (status.employeeRemaining <= 0) {
      return { allowed: false, reason: "employee_quota_exceeded", status };
    }
    return { allowed: true, status };
  }

  /** Ghi nhan 1 luot OCR thanh cong, tru vao han muc. Goi sau khi OCR + luu sheet thanh cong. */
  consumeOnSuccess(employee: Employee, docType: DocType, detail?: string): QuotaStatus {
    const month = currentMonthKey(this.now());
    this.usageRepo.record(employee.id, docType, "success", month, detail);
    return this.getStatus(employee);
  }

  recordFailure(employee: Employee, docType: DocType, detail?: string): void {
    const month = currentMonthKey(this.now());
    this.usageRepo.record(employee.id, docType, "failed", month, detail);
  }

  formatStatusMessage(status: QuotaStatus): string {
    return [
      `Han muc OCR thang ${status.month} cua ${status.employee.name}:`,
      `- Ca nhan: da dung ${status.employeeUsed}/${status.employeeQuota} (con ${status.employeeRemaining})`,
      `- Toan cong ty: da dung ${status.companyUsed}/${status.companyQuota} (con ${status.companyRemaining})`,
    ].join("\n");
  }
}
