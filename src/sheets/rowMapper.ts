import type { DocTypeValue, ExtractionResult } from "../ocr/types.js";

export interface RowMetadata {
  timestamp: string;
  employeeName: string;
  employeeZaloId: string;
}

export const VEHICLE_HEADER = [
  "Thoi gian",
  "NVKD",
  "Zalo ID NVKD",
  "Loai giay to",
  "Bien so xe",
  "Loai xe",
  "So cho ngoi",
  "Ho ten chu xe",
  "Dia chi",
  "So khung",
  "So may",
  "Tai trong",
  "Do tin cay",
  "Truong can kiem tra lai",
];

export const DOC_TYPE_LABEL: Record<DocTypeValue, string> = {
  vehicle_registration: "Dang ky xe",
  insurance: "Bao hiem xe",
  unknown: "Khong xac dinh",
};

/** Chuyen ExtractionResult (vehicle_registration hoac insurance) thanh 1 hang cho Google Sheet chung. Tra ve undefined neu thieu du lieu xe. */
export function toVehicleRow(result: ExtractionResult, meta: RowMetadata): unknown[] | undefined {
  if (!result.vehicle) return undefined;
  const f = result.vehicle;
  return [
    meta.timestamp,
    meta.employeeName,
    meta.employeeZaloId,
    DOC_TYPE_LABEL[result.documentType],
    f.vehiclePlate,
    f.vehicleType,
    f.seatCount,
    f.ownerName,
    f.address,
    f.chassisNumber,
    f.engineNumber,
    f.loadCapacity,
    result.confidence,
    result.lowConfidenceFields.join(", "),
  ];
}
