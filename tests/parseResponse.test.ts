import { describe, expect, it } from "vitest";
import { InvalidExtractionResponseError, parseExtractionResponse } from "../src/ocr/parseResponse.js";

describe("parseExtractionResponse", () => {
  it("parses a valid vehicle_registration response", () => {
    const raw = JSON.stringify({
      documentType: "vehicle_registration",
      confidence: 0.92,
      vehicle: {
        vehiclePlate: "29A-123.45",
        vehicleType: "O to con",
        seatCount: "5",
        ownerName: "Nguyen Van A",
        address: "Ha Noi",
        chassisNumber: "RLN2US.HNLVNM076570",
        engineNumber: "1B22.765PSA10XVDPHN08",
        loadCapacity: "",
      },
      lowConfidenceFields: ["address"],
      rawText: "GIAY DANG KY XE ...",
    });

    const result = parseExtractionResponse(raw);
    expect(result.documentType).toBe("vehicle_registration");
    expect(result.vehicle?.ownerName).toBe("Nguyen Van A");
    expect(result.lowConfidenceFields).toEqual(["address"]);
  });

  it("parses a valid insurance response", () => {
    const raw = JSON.stringify({
      documentType: "insurance",
      confidence: 0.8,
      vehicle: {
        vehiclePlate: "29A-123.45",
        vehicleType: "O to con",
        seatCount: "5",
        ownerName: "Tran Thi B",
        address: "",
        chassisNumber: "",
        engineNumber: "",
        loadCapacity: "X",
      },
      lowConfidenceFields: [],
      rawText: "GIAY CHUNG NHAN BAO HIEM ...",
    });

    const result = parseExtractionResponse(raw);
    expect(result.documentType).toBe("insurance");
    expect(result.vehicle?.vehiclePlate).toBe("29A-123.45");
  });

  it("fills missing optional string fields with empty string via defaults", () => {
    const raw = JSON.stringify({
      documentType: "vehicle_registration",
      confidence: 0.5,
      vehicle: { ownerName: "A" },
      lowConfidenceFields: [],
      rawText: "",
    });

    const result = parseExtractionResponse(raw);
    expect(result.vehicle?.ownerName).toBe("A");
    expect(result.vehicle?.vehiclePlate).toBe("");
  });

  it("throws InvalidExtractionResponseError on malformed JSON", () => {
    expect(() => parseExtractionResponse("not json")).toThrow(InvalidExtractionResponseError);
  });

  it("throws InvalidExtractionResponseError when documentType is missing", () => {
    const raw = JSON.stringify({ confidence: 0.5, lowConfidenceFields: [], rawText: "" });
    expect(() => parseExtractionResponse(raw)).toThrow(InvalidExtractionResponseError);
  });

  it("handles unknown documentType gracefully (no vehicle data)", () => {
    const raw = JSON.stringify({
      documentType: "unknown",
      confidence: 0.1,
      lowConfidenceFields: [],
      rawText: "khong ro noi dung",
    });
    const result = parseExtractionResponse(raw);
    expect(result.documentType).toBe("unknown");
    expect(result.vehicle).toBeUndefined();
  });
});
