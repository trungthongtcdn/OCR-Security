import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  zalo_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  monthly_quota INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  is_admin INTEGER NOT NULL DEFAULT 0,
  is_group INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS usage_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id),
  doc_type TEXT NOT NULL,
  status TEXT NOT NULL,
  month TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_usage_logs_employee_month
  ON usage_logs(employee_id, month, status);

CREATE TABLE IF NOT EXISTS company_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  monthly_quota INTEGER NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS zalo_group_candidates (
  group_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  total_member INTEGER NOT NULL DEFAULT 0,
  first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

export type DB = Database.Database;

/** Them cot con thieu vao 1 bang da ton tai - dung cho cac DB file da tao tu truoc khi cot nay xuat hien. */
function ensureColumn(db: DB, table: string, column: string, definition: string): void {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!columns.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export function openDatabase(file: string): DB {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  ensureColumn(db, "employees", "is_group", "INTEGER NOT NULL DEFAULT 0");
  return db;
}

export function ensureCompanyConfig(db: DB, defaultMonthlyQuota: number): void {
  const row = db.prepare("SELECT id FROM company_config WHERE id = 1").get();
  if (!row) {
    db.prepare("INSERT INTO company_config (id, monthly_quota) VALUES (1, ?)").run(
      defaultMonthlyQuota,
    );
  }
}
