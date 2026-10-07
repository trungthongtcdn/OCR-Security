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

export function validateChassisNumber(rawValue: string): string[] {
  if (!rawValue) return [];
  const code = normalizeCode(rawValue);
  const issues: string[] = [];

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
 * So may khong co chuan quoc te chung (tuy nha san xuat), nen chi kiem tra duoc do dai hop ly -
 * qua ngan thuong la doc thieu ky tu, qua dai thuong la dinh them chu cua nhan/truong ben canh
 * (vi du loai sai o buoc tach nhan tren van ban tho - xem visionCrossCheck.ts).
 */
export function validateEngineNumber(rawValue: string): string[] {
  if (!rawValue) return [];
  const code = normalizeCode(rawValue);
  const issues: string[] = [];

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
