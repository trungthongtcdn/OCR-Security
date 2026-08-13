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
 * Chi cho phep ky tu ASCII chu+so/dau cham/gach ngang - ma so khung/so may luon la dang nay.
 * Dung de cat gia tri dung cho ngay truoc nhan tiep theo khi 2 nhan nam tren cung 1 "dong" van
 * ban (vi du rawText cua Gemini khong giu xuong dong nhu Cloud Vision): tu tieng Viet co dau
 * (nhan ke tiep) se luon chua ky tu ngoai ASCII nen bi loai ngay.
 */
const CODE_TOKEN_RE = /^[A-Za-z0-9][A-Za-z0-9.\-]*$/;

function takeCodeTokens(text: string): string {
  const tokens: string[] = [];
  for (const token of text.split(/\s+/).filter(Boolean)) {
    if (!CODE_TOKEN_RE.test(token)) break;
    tokens.push(token);
  }
  return tokens.join(" ");
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
    if (afterLabel) return takeCodeTokens(afterLabel) || afterLabel;
    const nextLine = lines[i + 1];
    if (nextLine) return takeCodeTokens(nextLine.trim()) || nextLine.trim();
  }
  return undefined;
}
