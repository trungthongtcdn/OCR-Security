import type { DB } from "./database.js";

export interface Employee {
  id: number;
  zaloId: string;
  name: string;
  monthlyQuota: number;
  active: boolean;
  createdAt: string;
}

interface EmployeeRow {
  id: number;
  zalo_id: string;
  name: string;
  monthly_quota: number;
  active: number;
  created_at: string;
}

function mapRow(row: EmployeeRow): Employee {
  return {
    id: row.id,
    zaloId: row.zalo_id,
    name: row.name,
    monthlyQuota: row.monthly_quota,
    active: row.active === 1,
    createdAt: row.created_at,
  };
}

export class EmployeeRepo {
  constructor(private readonly db: DB) {}

  findByZaloId(zaloId: string): Employee | undefined {
    const row = this.db
      .prepare<[string], EmployeeRow>("SELECT * FROM employees WHERE zalo_id = ?")
      .get(zaloId);
    return row ? mapRow(row) : undefined;
  }

  findByNameLike(query: string): Employee[] {
    const rows = this.db
      .prepare<[string], EmployeeRow>(
        "SELECT * FROM employees WHERE name LIKE ? ORDER BY name ASC",
      )
      .all(`%${query}%`);
    return rows.map(mapRow);
  }

  getOrCreate(zaloId: string, name: string, defaultMonthlyQuota: number): Employee {
    const existing = this.findByZaloId(zaloId);
    if (existing) return existing;
    const info = this.db
      .prepare<[string, string, number]>(
        "INSERT INTO employees (zalo_id, name, monthly_quota) VALUES (?, ?, ?)",
      )
      .run(zaloId, name, defaultMonthlyQuota);
    return this.findByZaloId(zaloId) ?? this.mustFindById(Number(info.lastInsertRowid));
  }

  mustFindById(id: number): Employee {
    const row = this.db
      .prepare<[number], EmployeeRow>("SELECT * FROM employees WHERE id = ?")
      .get(id);
    if (!row) throw new Error(`Khong tim thay nhan vien id=${id}`);
    return mapRow(row);
  }

  setMonthlyQuota(zaloId: string, quota: number): Employee | undefined {
    this.db.prepare("UPDATE employees SET monthly_quota = ? WHERE zalo_id = ?").run(
      quota,
      zaloId,
    );
    return this.findByZaloId(zaloId);
  }

  setActive(zaloId: string, active: boolean): Employee | undefined {
    this.db
      .prepare("UPDATE employees SET active = ? WHERE zalo_id = ?")
      .run(active ? 1 : 0, zaloId);
    return this.findByZaloId(zaloId);
  }

  listAll(): Employee[] {
    const rows = this.db
      .prepare<[], EmployeeRow>("SELECT * FROM employees ORDER BY name ASC")
      .all();
    return rows.map(mapRow);
  }
}
