import { GeminiExtractionResponseSchema, type ExtractionResult } from "./types.js";

export class InvalidExtractionResponseError extends Error {
  constructor(cause: unknown, raw: string) {
    super(`Gemini tra ve JSON khong dung schema: ${String(cause)}. Raw: ${raw.slice(0, 500)}`);
    this.name = "InvalidExtractionResponseError";
  }
}

/** Parse + validate chuoi JSON tra ve tu Gemini thanh ExtractionResult da chuan hoa. */
export function parseExtractionResponse(rawJson: string): ExtractionResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch (err) {
    throw new InvalidExtractionResponseError(err, rawJson);
  }

  const result = GeminiExtractionResponseSchema.safeParse(parsed);
  if (!result.success) {
    throw new InvalidExtractionResponseError(result.error, rawJson);
  }

  const data = result.data;
  return {
    documentType: data.documentType,
    confidence: data.confidence,
    vehicle: data.documentType !== "unknown" ? data.vehicle : undefined,
    lowConfidenceFields: data.lowConfidenceFields,
    rawText: data.rawText,
  };
}
