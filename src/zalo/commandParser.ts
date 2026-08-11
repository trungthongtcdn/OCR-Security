export type ParsedCommand =
  | { kind: "help" }
  | { kind: "check_own_quota" }
  | { kind: "check_company_quota" }
  | { kind: "list_all_quota" }
  | { kind: "check_employee_quota"; target: string }
  | { kind: "set_employee_quota"; target: string; quota: number }
  | { kind: "set_company_quota"; quota: number }
  | { kind: "set_employee_active"; target: string; active: boolean }
  | { kind: "unknown"; raw: string };

/** Bo dau tieng Viet + ha chu thuong, dung de so khop tu khoa linh hoat. */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .trim()
    .toLowerCase();
}

const QUOTA_KEYWORDS = ["han muc", "/quota", "quota"];
const HELP_KEYWORDS = ["/help", "help", "huong dan"];

/**
 * Phan tich mot tin nhan van ban thanh lenh. `isAdmin` quyet dinh cac lenh quan tri
 * (tra soat toan cong ty, cap/sua han muc, bat/tat NVKD) co duoc nhan dien hay khong -
 * NVKD thuong chi nhan duoc "check_own_quota" hoac "unknown".
 */
export function parseCommand(rawText: string, isAdmin: boolean): ParsedCommand {
  const text = rawText.trim();
  const norm = normalize(text);

  if (HELP_KEYWORDS.some((k) => norm === k || norm.startsWith(k))) {
    return { kind: "help" };
  }

  if (isAdmin) {
    const setQuotaMatch = text.match(/^\/setquota\s+(.+?)\s+(\d+)\s*$/i);
    if (setQuotaMatch?.[1] && setQuotaMatch[2]) {
      return {
        kind: "set_employee_quota",
        target: setQuotaMatch[1].trim(),
        quota: Number.parseInt(setQuotaMatch[2], 10),
      };
    }

    const setCompanyMatch = text.match(/^\/setcompanyquota\s+(\d+)\s*$/i);
    if (setCompanyMatch?.[1]) {
      return { kind: "set_company_quota", quota: Number.parseInt(setCompanyMatch[1], 10) };
    }

    const activeMatch = text.match(/^\/active\s+(.+?)\s+(on|off|bat|tat)\s*$/i);
    if (activeMatch?.[1] && activeMatch[2]) {
      const activeToken = activeMatch[2].toLowerCase();
      return {
        kind: "set_employee_active",
        target: activeMatch[1].trim(),
        active: activeToken === "on" || activeToken === "bat",
      };
    }

    if (/^\/quota\s+all\s*$/i.test(text) || norm === "danh sach han muc") {
      return { kind: "list_all_quota" };
    }

    if (norm === "han muc cong ty" || norm === "tong han muc") {
      return { kind: "check_company_quota" };
    }

    const quotaTargetMatch = text.match(/^\/quota\s+(.+)$/i);
    if (quotaTargetMatch?.[1]) {
      return { kind: "check_employee_quota", target: quotaTargetMatch[1].trim() };
    }

    const hanMucTargetMatch = norm.match(/^han muc\s+(.+)$/);
    if (hanMucTargetMatch?.[1]) {
      return { kind: "check_employee_quota", target: hanMucTargetMatch[1].trim() };
    }
  }

  if (QUOTA_KEYWORDS.some((k) => norm === normalize(k) || norm.startsWith(normalize(k)))) {
    return { kind: "check_own_quota" };
  }

  return { kind: "unknown", raw: text };
}
