import { Type, type Schema } from "@google/genai";

const driverLicenseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    fullName: { type: Type.STRING, description: "Ho va ten" },
    dateOfBirth: { type: Type.STRING, description: "Ngay sinh, dd/mm/yyyy" },
    licenseNumber: { type: Type.STRING, description: "So GPLX" },
    licenseClass: { type: Type.STRING, description: "Hang GPLX, vi du A1, B2, C" },
    nationalIdNumber: { type: Type.STRING, description: "So CMND/CCCD neu co in tren GPLX" },
    address: { type: Type.STRING, description: "Dia chi / noi cu tru" },
    issueDate: { type: Type.STRING, description: "Ngay cap, dd/mm/yyyy" },
    expiryDate: { type: Type.STRING, description: "Ngay het han / co gia tri den, dd/mm/yyyy" },
    issuePlace: { type: Type.STRING, description: "Noi cap" },
  },
  required: [
    "fullName",
    "dateOfBirth",
    "licenseNumber",
    "licenseClass",
    "nationalIdNumber",
    "address",
    "issueDate",
    "expiryDate",
    "issuePlace",
  ],
};

const insuranceSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    ownerName: { type: Type.STRING, description: "Ten chu xe / ben mua bao hiem" },
    vehiclePlate: { type: Type.STRING, description: "Bien so xe" },
    vehicleType: { type: Type.STRING, description: "Loai xe / nhan hieu / so cho" },
    chassisNumber: { type: Type.STRING, description: "So khung" },
    engineNumber: { type: Type.STRING, description: "So may" },
    insuranceCompany: { type: Type.STRING, description: "Cong ty bao hiem" },
    policyNumber: { type: Type.STRING, description: "So giay chung nhan bao hiem / hop dong" },
    effectiveDate: { type: Type.STRING, description: "Hieu luc tu ngay, dd/mm/yyyy" },
    expiryDate: { type: Type.STRING, description: "Hieu luc den ngay, dd/mm/yyyy" },
    premium: { type: Type.STRING, description: "Phi bao hiem (neu co ghi tren giay)" },
  },
  required: [
    "ownerName",
    "vehiclePlate",
    "vehicleType",
    "chassisNumber",
    "engineNumber",
    "insuranceCompany",
    "policyNumber",
    "effectiveDate",
    "expiryDate",
    "premium",
  ],
};

export const extractionResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    documentType: {
      type: Type.STRING,
      enum: ["driver_license", "insurance", "unknown"],
      description: "Loai giay to nhan dien duoc",
    },
    confidence: { type: Type.NUMBER, description: "Do tin cay tong the, 0 den 1" },
    driverLicense: driverLicenseSchema,
    insurance: insuranceSchema,
    lowConfidenceFields: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Danh sach ten truong co do tin cay thap (vi du doc chu viet tay)",
    },
    rawText: { type: Type.STRING, description: "Toan bo van ban doc duoc tren anh" },
  },
  required: ["documentType", "confidence", "lowConfidenceFields", "rawText"],
};
