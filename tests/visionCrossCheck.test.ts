import { describe, expect, it } from "vitest";
import { findLabeledValue, normalizeCode } from "../src/ocr/visionCrossCheck.js";

describe("normalizeCode", () => {
  it("uppercases and strips punctuation/spaces", () => {
    expect(normalizeCode("rn2us.hnlvnm076570")).toBe("RN2USHNLVNM076570");
    expect(normalizeCode("29A-123.45")).toBe("29A12345");
  });

  it("strips Vietnamese diacritics", () => {
    expect(normalizeCode("Đường")).toBe("DUONG");
  });

  it("treats equivalent codes with different punctuation as equal", () => {
    expect(normalizeCode("RN2US.HNLVNM076570")).toBe(normalizeCode("RN2US HNLVNM 076570"));
  });
});

describe("findLabeledValue", () => {
  it("finds the value after a label on the same line", () => {
    const text = "CHU XE: LE HUU DOAN\nSO KHUNG: RN2USHNLVNM076570\nSO MAY: D4DDET586812";
    expect(findLabeledValue(text, ["SO KHUNG"])).toBe("RN2USHNLVNM076570");
    expect(findLabeledValue(text, ["SO MAY"])).toBe("D4DDET586812");
  });

  it("is diacritic-insensitive when matching the label", () => {
    const text = "Số khung: RN2USHNLVNM076570";
    expect(findLabeledValue(text, ["SO KHUNG"])).toBe("RN2USHNLVNM076570");
  });

  it("falls back to the next line when the label has no value on its own line", () => {
    const text = "SO KHUNG\nRN2USHNLVNM076570";
    expect(findLabeledValue(text, ["SO KHUNG"])).toBe("RN2USHNLVNM076570");
  });

  it("returns undefined when the label is not present", () => {
    const text = "CHU XE: LE HUU DOAN";
    expect(findLabeledValue(text, ["SO KHUNG"])).toBeUndefined();
  });

  it("stops at the next label when multiple fields share one line (no newlines, e.g. Gemini rawText)", () => {
    const text =
      "SỐ KHUNG: RN15 B29SA KEC003294 SỐ MÁY: D4DD ET 586812 LOẠI XE: ô tô khách TRỌNG TẢI: tấn";
    expect(findLabeledValue(text, ["SO KHUNG"])).toBe("RN15 B29SA KEC003294");
    expect(findLabeledValue(text, ["SO MAY"])).toBe("D4DD ET 586812");
  });
});
