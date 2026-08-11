import type { ExtractionResult } from "../ocr/types.js";

export interface RowMetadata {
  timestamp: string;
  employeeName: string;
  employeeZaloId: string;
}

export const LICENSE_HEADER = [
  "Thoi gian",
  "NVKD",
  "Zalo ID NVKD",
  "Ho ten",
  "Ngay sinh",
  "So GPLX",
  "Hang",
  "So CMND/CCCD",
  "Dia chi",
  "Ngay cap",
  "Ngay het han",
  "Noi cap",
  "Do tin cay",
  "Truong can kiem tra lai",
];

export const INSURANCE_HEADER = [
  "Thoi gian",
  "NVKD",
  "Zalo ID NVKD",
  "Chu xe",
  "Bien so",
  "Loai xe",
  "So khung",
  "So may",
  "Cong ty bao hiem",
  "So giay CN/HD",
  "Hieu luc tu",
  "Hieu luc den",
  "Phi bao hiem",
  "Do tin cay",
  "Truong can kiem tra lai",
];

/** Chuyen ExtractionResult (documentType = driver_license) thanh 1 hang cho Google Sheet. Tra ve undefined neu khong phai loai nay hoac thieu du lieu. */
export function toLicenseRow(result: ExtractionResult, meta: RowMetadata): unknown[] | undefined {
  if (result.documentType !== "driver_license" || !result.driverLicense) return undefined;
  const f = result.driverLicense;
  return [
    meta.timestamp,
    meta.employeeName,
    meta.employeeZaloId,
    f.fullName,
    f.dateOfBirth,
    f.licenseNumber,
    f.licenseClass,
    f.nationalIdNumber,
    f.address,
    f.issueDate,
    f.expiryDate,
    f.issuePlace,
    result.confidence,
    result.lowConfidenceFields.join(", "),
  ];
}

/** Chuyen ExtractionResult (documentType = insurance) thanh 1 hang cho Google Sheet. Tra ve undefined neu khong phai loai nay hoac thieu du lieu. */
export function toInsuranceRow(result: ExtractionResult, meta: RowMetadata): unknown[] | undefined {
  if (result.documentType !== "insurance" || !result.insurance) return undefined;
  const f = result.insurance;
  return [
    meta.timestamp,
    meta.employeeName,
    meta.employeeZaloId,
    f.ownerName,
    f.vehiclePlate,
    f.vehicleType,
    f.chassisNumber,
    f.engineNumber,
    f.insuranceCompany,
    f.policyNumber,
    f.effectiveDate,
    f.expiryDate,
    f.premium,
    result.confidence,
    result.lowConfidenceFields.join(", "),
  ];
}
