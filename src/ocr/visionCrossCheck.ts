function stripDiacritics(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d");
}

/** Chuan hoa 1 ma chu+so de so sanh: bo dau, viet hoa, bo het ky tu khong phai chu/so (dau cham, gach ngang, khoang trang...). */
export function normalizeCode(value: string): string {
  return stripDiacritics(value).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Cloud Vision chi tra ve van ban tho theo dong, khong hieu "day la truong so khung" - nen tu tim
 * gia tri bang cach do dong chua 1 trong cac tu khoa nhan (vi du "SO KHUNG"), roi lay phan con lai
 * sau dau ":" tren cung dong (hoac dong ke tiep neu nhan nam rieng 1 dong).
 */
export function findLabeledValue(fullText: string, labelKeywords: string[]): string | undefined {
  const lines = fullText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const normalizedLabels = labelKeywords.map((label) => stripDiacritics(label).toUpperCase());

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const normalizedLine = stripDiacritics(line).toUpperCase();
    const matchedLabel = normalizedLabels.find((label) => normalizedLine.includes(label));
    if (!matchedLabel) continue;

    const idx = normalizedLine.indexOf(matchedLabel);
    const afterLabel = line
      .slice(idx + matchedLabel.length)
      .replace(/^[:.\s]+/, "")
      .trim();
    if (afterLabel) return afterLabel;
    const nextLine = lines[i + 1];
    if (nextLine) return nextLine.trim();
  }
  return undefined;
}
