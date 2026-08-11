import { describe, expect, it } from "vitest";
import { toInsuranceRow, toLicenseRow } from "../src/sheets/rowMapper.js";
import type { ExtractionResult } from "../src/ocr/types.js";

const meta = { timestamp: "2026-08-11T10:00:00Z", employeeName: "Nguyen Van A", employeeZaloId: "zalo-1" };

describe("rowMapper", () => {
  it("maps a driver_license extraction to a sheet row", () => {
    const result: ExtractionResult = {
      documentType: "driver_license",
      confidence: 0.9,
      driverLicense: {
        fullName: "Le Van C",
        dateOfBirth: "01/01/1990",
        licenseNumber: "123",
        licenseClass: "B2",
        nationalIdNumber: "",
        address: "",
        issueDate: "",
        expiryDate: "",
        issuePlace: "",
      },
      lowConfidenceFields: ["address"],
      rawText: "",
    };

    const row = toLicenseRow(result, meta);
    expect(row).toBeDefined();
    const r = row!;
    expect(r[0]).toBe(meta.timestamp);
    expect(r[3]).toBe("Le Van C");
    expect(r[6]).toBe("B2");
    expect(r[r.length - 1]).toBe("address");
  });

  it("returns undefined for toLicenseRow when documentType is insurance", () => {
    const result: ExtractionResult = {
      documentType: "insurance",
      confidence: 0.5,
      lowConfidenceFields: [],
      rawText: "",
    };
    expect(toLicenseRow(result, meta)).toBeUndefined();
  });

  it("maps an insurance extraction to a sheet row", () => {
    const result: ExtractionResult = {
      documentType: "insurance",
      confidence: 0.75,
      insurance: {
        ownerName: "Pham Thi D",
        vehiclePlate: "30F-999.99",
        vehicleType: "",
        chassisNumber: "",
        engineNumber: "",
        insuranceCompany: "PVI",
        policyNumber: "PVI-001",
        effectiveDate: "01/01/2024",
        expiryDate: "01/01/2025",
        premium: "",
      },
      lowConfidenceFields: [],
      rawText: "",
    };

    const row = toInsuranceRow(result, meta);
    expect(row).toBeDefined();
    expect(row?.[4]).toBe("30F-999.99");
    expect(row?.[8]).toBe("PVI");
  });

  it("returns undefined for toInsuranceRow when documentType is unknown", () => {
    const result: ExtractionResult = {
      documentType: "unknown",
      confidence: 0.1,
      lowConfidenceFields: [],
      rawText: "",
    };
    expect(toInsuranceRow(result, meta)).toBeUndefined();
  });
});
