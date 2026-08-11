import type { DB } from "./database.js";

export type UsageStatus = "success" | "failed";
export type DocType = "vehicle_registration" | "insurance" | "unknown";

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

  listRecent(limit: number): UsageLogEntry[] {
    return this.db
      .prepare<[number], UsageLogEntry>(
        `SELECT usage_logs.id as id, employees.name as employeeName, employees.zalo_id as employeeZaloId,
                doc_type as docType, status, month, detail, usage_logs.created_at as createdAt
         FROM usage_logs
         JOIN employees ON employees.id = usage_logs.employee_id
         ORDER BY usage_logs.id DESC
         LIMIT ?`,
      )
      .all(limit);
  }
}

export interface UsageLogEntry {
  id: number;
  employeeName: string;
  employeeZaloId: string;
  docType: string;
  status: string;
  month: string;
  detail: string | null;
  createdAt: string;
}
