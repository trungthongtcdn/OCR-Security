import { GoogleGenAI } from "@google/genai";
import { logger } from "../logger.js";
import { extractionResponseSchema } from "./geminiSchema.js";
import { parseExtractionResponse } from "./parseResponse.js";
import { SYSTEM_INSTRUCTION, USER_PROMPT } from "./promptTemplates.js";
import type { ExtractionResult } from "./types.js";

export interface ImageInput {
  base64Data: string;
  mimeType: string;
}

/**
 * Model Gemini manh nhat hien dang GA (khong con tang "Pro" GA cong khai tinh den luc viet code
 * nay), dung de tu dong doc lai anh khi lan doc dau tien co truong do tin cay thap (thuong la
 * do chu viet tay) - bat ke Admin dang cau hinh model nao lam mac dinh de tiet kiem chi phi.
 */
export const PREMIUM_GEMINI_MODEL = "gemini-3.6-flash";

export class GeminiOcrClient {
  private readonly ai: GoogleGenAI;

  constructor(
    apiKey: string,
    private readonly model: string,
  ) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async extract(image: ImageInput): Promise<ExtractionResult> {
    const response = await this.ai.models.generateContent({
      model: this.model,
      contents: [
        {
          role: "user",
          parts: [
            { text: USER_PROMPT },
            { inlineData: { mimeType: image.mimeType, data: image.base64Data } },
          ],
        },
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: extractionResponseSchema,
        temperature: 0.1,
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("Gemini khong tra ve noi dung (response.text rong)");
    }

    logger.debug({ model: this.model }, "gemini ocr response received");
    return parseExtractionResponse(text);
  }
}
