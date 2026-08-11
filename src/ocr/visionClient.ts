import { google, type vision_v1 } from "googleapis";
import type { ServiceAccountCredentials } from "../db/settingsRepo.js";
import type { ImageInput } from "./geminiClient.js";

/**
 * Google Cloud Vision (DOCUMENT_TEXT_DETECTION) - dung lam "y kien thu 2" doc doc lap voi Gemini,
 * de doi chieu cheo cac ma chu+so quan trong (so khung/so may). Dung lai chinh service account JSON
 * da cau hinh cho Google Sheets (cung 1 Google Cloud project), chi can bat them Cloud Vision API.
 */
export class VisionOcrClient {
  private api: vision_v1.Vision | undefined;

  constructor(private readonly credentials: ServiceAccountCredentials) {}

  private async getApi(): Promise<vision_v1.Vision> {
    if (this.api) return this.api;
    const auth = new google.auth.GoogleAuth({
      credentials: this.credentials,
      scopes: ["https://www.googleapis.com/auth/cloud-vision"],
    });
    this.api = google.vision({ version: "v1", auth });
    return this.api;
  }

  /** Doc toan bo van ban IN tren anh (khong hieu chu viet tay tot). Tra ve "" neu khong doc duoc gi. */
  async detectText(image: ImageInput): Promise<string> {
    const api = await this.getApi();
    const res = await api.images.annotate({
      requestBody: {
        requests: [
          {
            image: { content: image.base64Data },
            features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
            imageContext: { languageHints: ["vi"] },
          },
        ],
      },
    });
    const response = res.data.responses?.[0];
    if (response?.error?.message) {
      throw new Error(`Cloud Vision loi: ${response.error.message}`);
    }
    return response?.fullTextAnnotation?.text ?? "";
  }
}
