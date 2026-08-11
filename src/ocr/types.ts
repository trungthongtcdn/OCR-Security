import { z } from "zod";

export const DocTypeSchema = z.enum(["vehicle_registration", "insurance", "unknown"]);
export type DocTypeValue = z.infer<typeof DocTypeSchema>;

/**
 * Bo truong du lieu xe dung chung cho ca 2 loai giay to duoc ho tro: giay dang ky xe (ca vet)
 * va giay chung nhan bao hiem xe - vi ca 2 loai deu chua cung mot bo thong tin xe/chu xe.
 * Tat ca field la string rong "" neu khong doc duoc.
 */
export const VehicleFieldsSchema = z.object({
  vehiclePlate: z.string().default(""),
  vehicleType: z.string().default(""),
  seatCount: z.string().default(""),
  ownerName: z.string().default(""),
  address: z.string().default(""),
  chassisNumber: z.string().default(""),
  engineNumber: z.string().default(""),
  loadCapacity: z.string().default(""),
});
export type VehicleFields = z.infer<typeof VehicleFieldsSchema>;

export const GeminiExtractionResponseSchema = z.object({
  documentType: DocTypeSchema,
  confidence: z.number().min(0).max(1).default(0),
  vehicle: VehicleFieldsSchema.optional(),
  lowConfidenceFields: z.array(z.string()).default([]),
  rawText: z.string().default(""),
});
export type GeminiExtractionResponse = z.infer<typeof GeminiExtractionResponseSchema>;

export interface ExtractionResult {
  documentType: DocTypeValue;
  confidence: number;
  vehicle?: VehicleFields;
  lowConfidenceFields: string[];
  rawText: string;
}
