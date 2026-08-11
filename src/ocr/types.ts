import { z } from "zod";

export const DocTypeSchema = z.enum(["driver_license", "insurance", "unknown"]);
export type DocTypeValue = z.infer<typeof DocTypeSchema>;

/** Ket qua boc tach GPLX (bang lai xe). Tat ca field text la string rong "" neu khong doc duoc. */
export const DriverLicenseFieldsSchema = z.object({
  fullName: z.string().default(""),
  dateOfBirth: z.string().default(""),
  licenseNumber: z.string().default(""),
  licenseClass: z.string().default(""),
  nationalIdNumber: z.string().default(""),
  address: z.string().default(""),
  issueDate: z.string().default(""),
  expiryDate: z.string().default(""),
  issuePlace: z.string().default(""),
});
export type DriverLicenseFields = z.infer<typeof DriverLicenseFieldsSchema>;

/** Ket qua boc tach giay chung nhan bao hiem xe cu. */
export const InsuranceFieldsSchema = z.object({
  ownerName: z.string().default(""),
  vehiclePlate: z.string().default(""),
  vehicleType: z.string().default(""),
  chassisNumber: z.string().default(""),
  engineNumber: z.string().default(""),
  insuranceCompany: z.string().default(""),
  policyNumber: z.string().default(""),
  effectiveDate: z.string().default(""),
  expiryDate: z.string().default(""),
  premium: z.string().default(""),
});
export type InsuranceFields = z.infer<typeof InsuranceFieldsSchema>;

export const GeminiExtractionResponseSchema = z.object({
  documentType: DocTypeSchema,
  confidence: z.number().min(0).max(1).default(0),
  driverLicense: DriverLicenseFieldsSchema.optional(),
  insurance: InsuranceFieldsSchema.optional(),
  lowConfidenceFields: z.array(z.string()).default([]),
  rawText: z.string().default(""),
});
export type GeminiExtractionResponse = z.infer<typeof GeminiExtractionResponseSchema>;

export interface ExtractionResult {
  documentType: DocTypeValue;
  confidence: number;
  driverLicense?: DriverLicenseFields;
  insurance?: InsuranceFields;
  lowConfidenceFields: string[];
  rawText: string;
}
