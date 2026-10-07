import { describe, expect, it } from "vitest";
import type { GeminiOcrClient, ImageInput } from "../src/ocr/geminiClient.js";
import type { ExtractionResult, VehicleFields } from "../src/ocr/types.js";
import { OcrPipeline } from "../src/pipeline/ocrPipeline.js";
import type { QuotaService } from "../src/quota/quotaService.js";
import type { GoogleSheetsClient } from "../src/sheets/googleSheetsClient.js";

function fakeGemini(result: ExtractionResult): GeminiOcrClient {
  return { extract: async (_image: ImageInput) => result } as unknown as GeminiOcrClient;
}

function baseVehicle(overrides: Partial<VehicleFields> = {}): ExtractionResult {
  return {
    documentType: "vehicle_registration",
    confidence: 0.9,
    vehicle: {
      vehiclePlate: "29A-123.45",
      vehicleType: "o to con",
      seatCount: "5",
      ownerName: "Nguyen Van A",
      address: "Ha Noi",
      chassisNumber: "RN2USHNLVNM076570", // 17 ky tu, dung dinh dang VIN
      engineNumber: "D4DDET586812",
      loadCapacity: "",
      ...overrides,
    },
    lowConfidenceFields: [],
    rawText: "",
  };
}

function makePipeline(gemini: GeminiOcrClient, premiumGemini: GeminiOcrClient): OcrPipeline {
  return new OcrPipeline(
    gemini,
    premiumGemini,
    undefined,
    {} as GoogleSheetsClient,
    {} as QuotaService,
    { tab: "test" },
  );
}

describe("OcrPipeline.readImage - validation theo dinh dang VIN", () => {
  it("khong danh dau gi khi so khung/so may dung dinh dang", async () => {
    const gemini = fakeGemini(baseVehicle());
    const result = await makePipeline(gemini, gemini).readImage({ base64Data: "x", mimeType: "image/jpeg" });

    expect(result.lowConfidenceFields).toEqual([]);
    expect(result.formatWarnings).toBeUndefined();
  });

  it("danh dau so khung sai dinh dang (18 ky tu) ngay ca khi Gemini bao tu tin", async () => {
    const gemini = fakeGemini(baseVehicle({ chassisNumber: "RN15B29SAKEC003294" }));
    // dung chung 1 model cho ca 2 vai tro -> khong doc lai, nhung van phai bi danh dau
    const result = await makePipeline(gemini, gemini).readImage({ base64Data: "x", mimeType: "image/jpeg" });

    expect(result.lowConfidenceFields).toContain("chassisNumber");
    expect(result.formatWarnings?.[0]).toContain("So khung");
  });

  it("tu dong doc lai bang model manh hon khi phat hien sai dinh dang, va dung ket qua doc lai neu tot hon", async () => {
    const badFirst = fakeGemini(baseVehicle({ chassisNumber: "RN15B29SAKEC003294" }));
    const goodRetry = fakeGemini(baseVehicle());

    const result = await makePipeline(badFirst, goodRetry).readImage({ base64Data: "x", mimeType: "image/jpeg" });

    expect(result.vehicle?.chassisNumber).toBe("RN2USHNLVNM076570");
    expect(result.lowConfidenceFields).toEqual([]);
    expect(result.formatWarnings).toBeUndefined();
  });

  it("danh dau khi so khung va so may doc ra giong het nhau", async () => {
    const gemini = fakeGemini(baseVehicle({ engineNumber: "RN2USHNLVNM076570" }));
    const result = await makePipeline(gemini, gemini).readImage({ base64Data: "x", mimeType: "image/jpeg" });

    expect(result.lowConfidenceFields).toEqual(
      expect.arrayContaining(["chassisNumber", "engineNumber"]),
    );
    expect(result.formatWarnings?.some((w) => w.includes("giong het nhau"))).toBe(true);
  });
});
