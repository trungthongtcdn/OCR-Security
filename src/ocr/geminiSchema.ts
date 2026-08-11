import { Type, type Schema } from "@google/genai";

const vehicleSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    vehiclePlate: { type: Type.STRING, description: "Bien so xe / bien kiem soat" },
    vehicleType: { type: Type.STRING, description: "Loai xe, vi du: o to con, xe tai, xe khach..." },
    seatCount: { type: Type.STRING, description: "So cho ngoi" },
    ownerName: { type: Type.STRING, description: "Ho ten chu xe" },
    address: { type: Type.STRING, description: "Dia chi chu xe" },
    chassisNumber: { type: Type.STRING, description: "So khung" },
    engineNumber: { type: Type.STRING, description: "So may" },
    loadCapacity: {
      type: Type.STRING,
      description: "Tai trong (thuong tinh bang tan). De trong hoac ghi dung ky hieu tren giay (vi du 'X') neu khong ap dung",
    },
  },
  required: [
    "vehiclePlate",
    "vehicleType",
    "seatCount",
    "ownerName",
    "address",
    "chassisNumber",
    "engineNumber",
    "loadCapacity",
  ],
};

export const extractionResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    documentType: {
      type: Type.STRING,
      enum: ["vehicle_registration", "insurance", "unknown"],
      description: "Loai giay to nhan dien duoc",
    },
    confidence: { type: Type.NUMBER, description: "Do tin cay tong the, 0 den 1" },
    vehicle: vehicleSchema,
    lowConfidenceFields: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Danh sach ten truong co do tin cay thap (vi du doc chu viet tay)",
    },
    rawText: { type: Type.STRING, description: "Toan bo van ban doc duoc tren anh" },
  },
  required: ["documentType", "confidence", "lowConfidenceFields", "rawText"],
};
