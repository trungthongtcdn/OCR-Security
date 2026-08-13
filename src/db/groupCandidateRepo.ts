import type { DB } from "./database.js";

export interface GroupCandidate {
  groupId: string;
  name: string;
  totalMember: number;
  firstSeenAt: string;
  lastSeenAt: string;
}

interface GroupCandidateRow {
  group_id: string;
  name: string;
  total_member: number;
  first_seen_at: string;
  last_seen_at: string;
}

function mapRow(row: GroupCandidateRow): GroupCandidate {
  return {
    groupId: row.group_id,
    name: row.name,
    totalMember: row.total_member,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
  };
}

/**
 * Cache cac nhom Zalo da tung nhan tin cho bot, de trang Admin tim/chon them lam "NVKD" ma khong
 * can goi API liet ke toan bo nhom cua tai khoan Admin (co the rat nhieu, cham, va tung bi Zalo
 * tra loi "Tham so khong hop le" khi lay ten hang loat) - nhom tu xuat hien ngay tu tin nhan dau
 * tien, Admin khong can bam dong bo lai khi co nhom moi.
 */
export class GroupCandidateRepo {
  constructor(private readonly db: DB) {}

  /** Cap nhat last_seen_at neu nhom da biet. Tra ve true neu da ton tai (khoi phai goi API lay ten lai). */
  touch(groupId: string): boolean {
    const result = this.db
      .prepare("UPDATE zalo_group_candidates SET last_seen_at = datetime('now') WHERE group_id = ?")
      .run(groupId);
    return result.changes > 0;
  }

  upsert(groupId: string, name: string, totalMember: number): void {
    this.db
      .prepare(
        `INSERT INTO zalo_group_candidates (group_id, name, total_member) VALUES (?, ?, ?)
         ON CONFLICT(group_id) DO UPDATE SET name = excluded.name, total_member = excluded.total_member, last_seen_at = datetime('now')`,
      )
      .run(groupId, name, totalMember);
  }

  listAll(): GroupCandidate[] {
    const rows = this.db
      .prepare<[], GroupCandidateRow>(
        "SELECT * FROM zalo_group_candidates ORDER BY last_seen_at DESC",
      )
      .all();
    return rows.map(mapRow);
  }
}
