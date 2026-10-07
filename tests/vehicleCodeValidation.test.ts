import { describe, expect, it } from "vitest";
import {
  computeVinCheckDigit,
  validateChassisNumber,
  validateCrossFields,
  validateEngineNumber,
} from "../src/ocr/vehicleCodeValidation.js";

describe("validateChassisNumber", () => {
  it("accepts a valid 17-character VIN with no I/O/Q", () => {
    expect(validateChassisNumber("RN2USHNLVNM076570")).toEqual([]);
  });

  it("flags a length other than 17", () => {
    // Day la vi du that tu Gemini doc sai tren 1 anh thuc te: 18 ky tu thay vi 17.
    const issues = validateChassisNumber("RN15B29SAKEC003294");
    expect(issues.some((i) => i.includes("18 ky tu"))).toBe(true);
  });

  it("flags forbidden VIN letters I, O, Q", () => {
    const issues = validateChassisNumber("RN2USHNLVNMO76570I"); // chua O va I
    expect(issues.some((i) => i.includes("chua ky tu"))).toBe(true);
  });

  it("flags an all-digit or all-letter value", () => {
    expect(validateChassisNumber("12345678901234567").some((i) => i.includes("toan chu hoac toan so"))).toBe(true);
    expect(validateChassisNumber("ABCDEFGHJKLMNPRSTU").some((i) => i.includes("toan chu hoac toan so"))).toBe(true);
  });

  it("returns no issues for an empty value (nothing to validate)", () => {
    expect(validateChassisNumber("")).toEqual([]);
  });

  it("flags a raw value containing lowercase letters (likely a leaked label fragment)", () => {
    const issues = validateChassisNumber("RN2USHNLVNm076570"); // chu 'm' thuong lan vao
    expect(issues.some((i) => i.includes("chu thuong"))).toBe(true);
  });

  it("flags a raw value containing Vietnamese diacritics (likely a leaked label fragment)", () => {
    const issues = validateChassisNumber("SỐ RN2USHNLVNM076570"); // dinh nham chu "SỐ" cua nhan
    expect(issues.some((i) => i.includes("co dau"))).toBe(true);
  });
});

describe("validateEngineNumber", () => {
  it("accepts a plausible-length engine number", () => {
    expect(validateEngineNumber("D4DDET586812")).toEqual([]);
  });

  it("flags a value that's too short", () => {
    expect(validateEngineNumber("AB12").some((i) => i.includes("qua ngan"))).toBe(true);
  });

  it("flags a value that's too long", () => {
    expect(validateEngineNumber("D4DDET586812SOMAYDAI123").some((i) => i.includes("qua dai"))).toBe(true);
  });

  it("flags a raw value containing lowercase letters or Vietnamese diacritics", () => {
    expect(validateEngineNumber("D4DDet586812").some((i) => i.includes("chu thuong"))).toBe(true);
    expect(validateEngineNumber("MÁY D4DDET586812").some((i) => i.includes("co dau"))).toBe(true);
  });
});

describe("validateCrossFields", () => {
  it("flags chassis and engine numbers that read identically", () => {
    const issues = validateCrossFields({
      chassisNumber: "RN2USHNLVNM076570",
      engineNumber: "RN2USHNLVNM076570",
      vehiclePlate: "29A-123.45",
    });
    expect(issues.some((i) => i.includes("giong het nhau"))).toBe(true);
  });

  it("returns no issues when all three fields differ", () => {
    const issues = validateCrossFields({
      chassisNumber: "RN2USHNLVNM076570",
      engineNumber: "D4DDET586812",
      vehiclePlate: "29A-123.45",
    });
    expect(issues).toEqual([]);
  });
});

describe("computeVinCheckDigit", () => {
  it("matches the classic worked example from the VIN standard (1M8GDM9AXKP042788 -> X)", () => {
    expect(computeVinCheckDigit("1M8GDM9AXKP042788")).toBe("X");
  });

  it("returns undefined for a value that isn't 17 characters", () => {
    expect(computeVinCheckDigit("RN2USHNLVNM07657")).toBeUndefined();
  });

  it("returns undefined when the value contains characters outside the VIN alphabet (e.g. I/O/Q)", () => {
    expect(computeVinCheckDigit("RN2USHNLVNMO76570")).toBeUndefined();
  });
});
