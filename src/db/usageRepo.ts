import type { DB } from "./database.js";

export type UsageStatus = "success" | "failed";
export type DocType = "driver_license" | "insurance" | "unknown";

export function currentMonthKey(date: Date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export class UsageRepo {
  constructor(private readonly db: DB) {}

  record(
    employeeId: number,
    docType: DocType,
    status: UsageStatus,
    month: string,
    detail?: string,
  ): void {
    this.db
      .prepare(
        "INSERT INTO usage_logs (employee_id, doc_type, status, month, detail) VALUES (?, ?, ?, ?, ?)",
      )
      .run(employeeId, docType, status, month, detail ?? null);
  }

  countSuccessForEmployeeInMonth(employeeId: number, month: string): number {
    const row = this.db
      .prepare<[number, string], { c: number }>(
        "SELECT COUNT(*) as c FROM usage_logs WHERE employee_id = ? AND month = ? AND status = 'success'",
      )
      .get(employeeId, month);
    return row?.c ?? 0;
  }

  countSuccessCompanyInMonth(month: string): number {
    const row = this.db
      .prepare<[string], { c: number }>(
        "SELECT COUNT(*) as c FROM usage_logs WHERE month = ? AND status = 'success'",
      )
      .get(month);
    return row?.c ?? 0;
  }
}
