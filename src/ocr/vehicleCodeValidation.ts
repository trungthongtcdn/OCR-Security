import { normalizeCode } from "./visionCrossCheck.js";

/**
 * Kiem tra DINH DANG so khung (VIN)/so may dua tren tieu chuan ISO 3779 (VIN quoc te) ma hau het
 * xe o to va xe may lap rap/ban chinh hang tai Viet Nam hien nay deu tuan theo khi dap so khung:
 * - Dai DUNG 17 ky tu.
 * - KHONG dung 3 chu I, O, Q (de tranh nham lan voi 1, 0 - day la quy dinh bat buoc cua chuan VIN,
 *   khong phai ngau nhien).
 * - Luon la to hop CA chu CA so (khong co so khung nao toan chu hoac toan so).
 *
 * Day la quy tac ve HINH DANG hop le, KHONG the xac nhan noi dung dung/sai - chi dung de phat hien
 * khi Gemini doc "tu tin" (khong tu danh dau lowConfidenceFields) nhung ket qua tra ve khong the
 * nao la 1 so khung/so may that, de tu dong kich hoat doc lai bang model manh hon va/hoac canh bao
 * NVKD kiem tra lai - khong bao gio tu dong "sua" hay bac bo ket qua. Xe rat cu/xe tu che/mot so
 * truong hop le ngoai co the khac 17 ky tu, nen chi danh dau "can kiem tra", khong coi la loi chac
 * chan.
 */
const VIN_LENGTH = 17;
const VIN_FORBIDDEN_LETTERS_RE = /[IOQ]/;

/**
 * So khung/so may in/dap tren giay luon la CHU HOA khong dau (tieng Viet co dau chi xuat hien o
 * cac nhan nhu "SO KHUNG", "SO MAY" ben canh) - neu gia tri RAW (truoc khi normalizeCode() bo dau
 * va viet hoa) co chu thuong hoac dau tieng Viet, nhieu kha nang Gemini da vo tinh ghep nham 1 phan
 * chu cua nhan/truong ke ben vao gia tri, giong dung loai loi ma visionCrossCheck.ts da tung bat
 * duoc o van ban tho cua Cloud Vision.
 */
function suspiciousRawCharsIssue(rawValue: string): string[] {
  if (/[a-z]/.test(rawValue)) {
    return ["chua chu thuong - so khung/so may in/dap tren giay luon viet HOA, co the da ghep nham chu cua nhan/truong ben canh"];
  }
  if (/[^\x00-\x7F]/.test(rawValue)) {
    return ["chua ky tu co dau (tieng Viet) - so khung/so may khong bao gio co dau, co the da ghep nham chu cua nhan/truong ben canh"];
  }
  return [];
}

export function validateChassisNumber(rawValue: string): string[] {
  if (!rawValue) return [];
  const code = normalizeCode(rawValue);
  const issues: string[] = [...suspiciousRawCharsIssue(rawValue)];

  const forbidden = code.match(VIN_FORBIDDEN_LETTERS_RE)?.[0];
  if (forbidden) {
    issues.push(
      `chua ky tu "${forbidden}" - VIN chuan khong bao gio dung I/O/Q (de tranh nham voi 1/0), nhieu kha nang da doc nham`,
    );
  }
  if (code.length !== VIN_LENGTH) {
    issues.push(`dai ${code.length} ky tu (so khung/VIN chuan co dung ${VIN_LENGTH} ky tu)`);
  }
  if (code && (!/[0-9]/.test(code) || !/[A-Z]/.test(code))) {
    issues.push("toan chu hoac toan so - so khung thuong la to hop ca chu va so");
  }
  return issues;
}

/**
 * So may khong co chuan quoc te chung (tuy nha san xuat), nen chi kiem tra duoc do dai hop ly va
 * dau hieu ghep nham nhan - qua ngan thuong la doc thieu ky tu, qua dai thuong la dinh them chu
 * cua nhan/truong ben canh (vi du loai sai o buoc tach nhan tren van ban tho - xem visionCrossCheck.ts).
 */
export function validateEngineNumber(rawValue: string): string[] {
  if (!rawValue) return [];
  const code = normalizeCode(rawValue);
  const issues: string[] = [...suspiciousRawCharsIssue(rawValue)];

  if (code.length < 5) {
    issues.push(`qua ngan (${code.length} ky tu) - co the da doc thieu`);
  } else if (code.length > 20) {
    issues.push(`qua dai (${code.length} ky tu) - co the da dinh nham chu cua truong khac vao`);
  }
  return issues;
}

/**
 * Kiem tra cheo giua cac truong ma so: neu 2 truong khac nhau lai ra cung 1 gia tri, nhieu kha
 * nang Gemini gan nham gia tri cua 1 truong sang (ca) truong kia, thay vi do la trung hop ngau
 * nhien - so khung/so may/bien so khong bao gio trung nhau tren thuc te.
 */
export function validateCrossFields(vehicle: {
  chassisNumber: string;
  engineNumber: string;
  vehiclePlate: string;
}): string[] {
  const chassis = normalizeCode(vehicle.chassisNumber);
  const engine = normalizeCode(vehicle.engineNumber);
  const plate = normalizeCode(vehicle.vehiclePlate);
  const issues: string[] = [];

  if (chassis && engine && chassis === engine) {
    issues.push("So khung va so may dang giong het nhau - co the da doc nham 1 truong thanh ca 2");
  }
  if (chassis && plate && chassis === plate) {
    issues.push("So khung va bien so dang giong het nhau - co the da doc nham truong");
  }
  if (engine && plate && engine === plate) {
    issues.push("So may va bien so dang giong het nhau - co the da doc nham truong");
  }
  return issues;
}

const VIN_TRANSLITERATION: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
  J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
};
const VIN_CHECK_DIGIT_WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

/**
 * Tinh ky tu kiem tra (check digit, vi tri 9) theo chuan VIN quoc te (ISO 3779 + bang trong so cua
 * SAE J853) - CHI DUNG DE THAM KHAO/LOG, KHONG duoc dua vao lowConfidenceFields hay kich hoat doc
 * lai (xem noi goi o ocrPipeline.ts). Ly do: check digit nay la yeu cau BAT BUOC THEO LUAT rieng
 * cua thi truong Bac My (NHTSA 49 CFR 565 / SAE J853), KHONG duoc ISO 3779 (ban quoc te) bat buoc
 * ap dung thong nhat o cac thi truong khac. Kiem chung thuc te: ngay ca so khung mau dang dung lam
 * du lieu test trong du an nay ("RN2USHNLVNM076570") cung KHONG khop quy tac nay (vi tri 9 la chu
 * "V", trong khi check digit hop le chi co the la 1 chu so hoac "X") - cho thay 1 phan dang ke so
 * khung thuc te tai Viet Nam khong tuan thu quy tac nay, nen bat no thanh canh bao "can kiem tra"
 * se tao qua nhieu canh bao sai (false positive) va lam giam long tin NVKD vao tinh nang.
 *
 * Tra ve undefined neu khong tinh duoc (khong du 17 ky tu, hoac chua ky tu khong hop le vi du
 * I/O/Q - cac truong hop nay da duoc validateChassisNumber() bao cao rieng).
 */
export function computeVinCheckDigit(vin17: string): string | undefined {
  if (vin17.length !== VIN_LENGTH) return undefined;
  let sum = 0;
  for (let i = 0; i < VIN_LENGTH; i++) {
    const ch = vin17[i] ?? "";
    const value = /[0-9]/.test(ch) ? Number(ch) : VIN_TRANSLITERATION[ch];
    if (value === undefined) return undefined;
    sum += value * VIN_CHECK_DIGIT_WEIGHTS[i]!;
  }
  const remainder = sum % 11;
  return remainder === 10 ? "X" : String(remainder);
}
