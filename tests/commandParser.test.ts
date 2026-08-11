import { describe, expect, it } from "vitest";
import { normalize, parseCommand } from "../src/zalo/commandParser.js";

describe("normalize", () => {
  it("strips Vietnamese diacritics and lowercases", () => {
    expect(normalize("Hạn Mức")).toBe("han muc");
    expect(normalize("Đăng ký")).toBe("dang ky");
  });
});

describe("parseCommand", () => {
  it("recognizes 'han muc' as check_own_quota for non-admin", () => {
    expect(parseCommand("han muc", false)).toEqual({ kind: "check_own_quota" });
    expect(parseCommand("Hạn mức của tôi", false)).toEqual({ kind: "check_own_quota" });
  });

  it("recognizes /quota as check_own_quota for non-admin (ignores admin-only targeting)", () => {
    expect(parseCommand("/quota", false)).toEqual({ kind: "check_own_quota" });
  });

  it("does not grant admin-only commands to non-admins", () => {
    expect(parseCommand("/quota all", false)).toEqual({ kind: "check_own_quota" });
    expect(parseCommand("/setquota An 100", false)).toEqual({
      kind: "unknown",
      raw: "/setquota An 100",
    });
  });

  it("recognizes /quota all as list_all_quota for admin", () => {
    expect(parseCommand("/quota all", true)).toEqual({ kind: "list_all_quota" });
  });

  it("recognizes company quota lookups for admin", () => {
    expect(parseCommand("han muc cong ty", true)).toEqual({ kind: "check_company_quota" });
    expect(parseCommand("Hạn mức công ty", true)).toEqual({ kind: "check_company_quota" });
  });

  it("recognizes /quota <target> as check_employee_quota for admin", () => {
    expect(parseCommand("/quota Nguyen Van A", true)).toEqual({
      kind: "check_employee_quota",
      target: "Nguyen Van A",
    });
  });

  it("recognizes natural language 'han muc <target>' for admin", () => {
    expect(parseCommand("han muc Nguyen Van A", true)).toEqual({
      kind: "check_employee_quota",
      target: "nguyen van a",
    });
  });

  it("parses /setquota <target> <number> for admin", () => {
    expect(parseCommand("/setquota Nguyen Van A 80", true)).toEqual({
      kind: "set_employee_quota",
      target: "Nguyen Van A",
      quota: 80,
    });
  });

  it("parses /setcompanyquota <number> for admin", () => {
    expect(parseCommand("/setcompanyquota 2000", true)).toEqual({
      kind: "set_company_quota",
      quota: 2000,
    });
  });

  it("parses /active <target> on|off for admin", () => {
    expect(parseCommand("/active Nguyen Van A off", true)).toEqual({
      kind: "set_employee_active",
      target: "Nguyen Van A",
      active: false,
    });
    expect(parseCommand("/active Nguyen Van A on", true)).toEqual({
      kind: "set_employee_active",
      target: "Nguyen Van A",
      active: true,
    });
  });

  it("recognizes /help and 'help' as help", () => {
    expect(parseCommand("/help", false)).toEqual({ kind: "help" });
    expect(parseCommand("help", true)).toEqual({ kind: "help" });
  });

  it("falls back to unknown for unrelated text", () => {
    expect(parseCommand("xin chao ban", false)).toEqual({ kind: "unknown", raw: "xin chao ban" });
  });
});
