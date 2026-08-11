import { describe, expect, it } from "vitest";
import { InvalidExtractionResponseError, parseExtractionResponse } from "../src/ocr/parseResponse.js";

describe("parseExtractionResponse", () => {
  it("parses a valid driver_license response", () => {
    const raw = JSON.stringify({
      documentType: "driver_license",
      confidence: 0.92,
      driverLicense: {
        fullName: "Nguyen Van A",
        dateOfBirth: "01/01/1990",
        licenseNumber: "123456789012",
        licenseClass: "B2",
        nationalIdNumber: "",
        address: "Ha Noi",
        issueDate: "01/01/2020",
        expiryDate: "01/01/2030",
        issuePlace: "",
      },
      lowConfidenceFields: ["address"],
      rawText: "GIAY PHEP LAI XE ...",
    });

    const result = parseExtractionResponse(raw);
    expect(result.documentType).toBe("driver_license");
    expect(result.driverLicense?.fullName).toBe("Nguyen Van A");
    expect(result.insurance).toBeUndefined();
    expect(result.lowConfidenceFields).toEqual(["address"]);
  });

  it("parses a valid insurance response", () => {
    const raw = JSON.stringify({
      documentType: "insurance",
      confidence: 0.8,
      insurance: {
        ownerName: "Tran Thi B",
        vehiclePlate: "29A-123.45",
        vehicleType: "",
        chassisNumber: "",
        engineNumber: "",
        insuranceCompany: "Bao Viet",
        policyNumber: "BH-0001",
        effectiveDate: "01/01/2024",
        expiryDate: "01/01/2025",
        premium: "",
      },
      lowConfidenceFields: [],
      rawText: "GIAY CHUNG NHAN BAO HIEM ...",
    });

    const result = parseExtractionResponse(raw);
    expect(result.documentType).toBe("insurance");
    expect(result.insurance?.vehiclePlate).toBe("29A-123.45");
    expect(result.driverLicense).toBeUndefined();
  });

  it("fills missing optional string fields with empty string via defaults", () => {
    const raw = JSON.stringify({
      documentType: "driver_license",
      confidence: 0.5,
      driverLicense: { fullName: "A" },
      lowConfidenceFields: [],
      rawText: "",
    });

    const result = parseExtractionResponse(raw);
    expect(result.driverLicense?.fullName).toBe("A");
    expect(result.driverLicense?.licenseNumber).toBe("");
  });

  it("throws InvalidExtractionResponseError on malformed JSON", () => {
    expect(() => parseExtractionResponse("not json")).toThrow(InvalidExtractionResponseError);
  });

  it("throws InvalidExtractionResponseError when documentType is missing", () => {
    const raw = JSON.stringify({ confidence: 0.5, lowConfidenceFields: [], rawText: "" });
    expect(() => parseExtractionResponse(raw)).toThrow(InvalidExtractionResponseError);
  });

  it("handles unknown documentType gracefully", () => {
    const raw = JSON.stringify({
      documentType: "unknown",
      confidence: 0.1,
      lowConfidenceFields: [],
      rawText: "khong ro noi dung",
    });
    const result = parseExtractionResponse(raw);
    expect(result.documentType).toBe("unknown");
    expect(result.driverLicense).toBeUndefined();
    expect(result.insurance).toBeUndefined();
  });
});
