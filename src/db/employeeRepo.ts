import type { DB } from "./database.js";

export interface Employee {
  id: number;
  zaloId: string;
  name: string;
  monthlyQuota: number;
  active: boolean;
  isAdmin: boolean;
  /** true = day la 1 nhom Zalo (zaloId la groupId) dung chung 1 han muc cho ca nhom, khong phai 1 nguoi. */
  isGroup: boolean;
  createdAt: string;
}

export interface EmployeeInput {
  zaloId: string;
  name: string;
  monthlyQuota: number;
  isAdmin?: boolean;
  isGroup?: boolean;
}

export interface EmployeeUpdate {
  name?: string;
  monthlyQuota?: number;
  active?: boolean;
  isAdmin?: boolean;
}

interface EmployeeRow {
  id: number;
  zalo_id: string;
  name: string;
  monthly_quota: number;
  active: number;
  is_admin: number;
  is_group: number;
  created_at: string;
}

function mapRow(row: EmployeeRow): Employee {
  return {
    id: row.id,
    zaloId: row.zalo_id,
    name: row.name,
    monthlyQuota: row.monthly_quota,
    active: row.active === 1,
    isAdmin: row.is_admin === 1,
    isGroup: row.is_group === 1,
    createdAt: row.created_at,
  };
}

export class EmployeeRepo {
  constructor(private readonly db: DB) {}

  findById(id: number): Employee | undefined {
    const row = this.db
      .prepare<[number], EmployeeRow>("SELECT * FROM employees WHERE id = ?")
      .get(id);
    return row ? mapRow(row) : undefined;
  }

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

  /** Them/cap nhat 1 NVKD (hoac 1 nhom Zalo) thu cong tu trang Admin, vi du dang ky truoc khi ho
   * tung nhan tin, hoac chon 1 nhom tu danh sach nhom cua tai khoan Admin. */
  upsertManual(input: EmployeeInput): Employee {
    this.db
      .prepare(
        `INSERT INTO employees (zalo_id, name, monthly_quota, is_admin, is_group) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(zalo_id) DO UPDATE SET name = excluded.name, monthly_quota = excluded.monthly_quota, is_admin = excluded.is_admin`,
      )
      .run(input.zaloId, input.name, input.monthlyQuota, input.isAdmin ? 1 : 0, input.isGroup ? 1 : 0);
    return this.mustFindByZaloId(input.zaloId);
  }

  updateById(id: number, update: EmployeeUpdate): Employee | undefined {
    const current = this.findById(id);
    if (!current) return undefined;
    this.db
      .prepare(
        "UPDATE employees SET name = ?, monthly_quota = ?, active = ?, is_admin = ? WHERE id = ?",
      )
      .run(
        update.name ?? current.name,
        update.monthlyQuota ?? current.monthlyQuota,
        (update.active ?? current.active) ? 1 : 0,
        (update.isAdmin ?? current.isAdmin) ? 1 : 0,
        id,
      );
    return this.findById(id);
  }

  mustFindById(id: number): Employee {
    const found = this.findById(id);
    if (!found) throw new Error(`Khong tim thay nhan vien id=${id}`);
    return found;
  }

  mustFindByZaloId(zaloId: string): Employee {
    const found = this.findByZaloId(zaloId);
    if (!found) throw new Error(`Khong tim thay nhan vien zalo_id=${zaloId}`);
    return found;
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

  isAdmin(zaloId: string): boolean {
    return this.findByZaloId(zaloId)?.isAdmin ?? false;
  }

  listAll(): Employee[] {
    const rows = this.db
      .prepare<[], EmployeeRow>("SELECT * FROM employees ORDER BY name ASC")
      .all();
    return rows.map(mapRow);
  }
}
