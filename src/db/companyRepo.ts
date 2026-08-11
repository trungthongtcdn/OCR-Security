import type { DB } from "./database.js";

export class CompanyRepo {
  constructor(private readonly db: DB) {}

  getMonthlyQuota(): number {
    const row = this.db
      .prepare<[], { monthly_quota: number }>(
        "SELECT monthly_quota FROM company_config WHERE id = 1",
      )
      .get();
    if (!row) throw new Error("Chua khoi tao cau hinh cong ty (company_config)");
    return row.monthly_quota;
  }

  setMonthlyQuota(quota: number): void {
    this.db
      .prepare("UPDATE company_config SET monthly_quota = ?, updated_at = datetime('now') WHERE id = 1")
      .run(quota);
  }
}
