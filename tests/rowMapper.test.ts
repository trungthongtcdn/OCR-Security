import { describe, expect, it } from "vitest";
import { toVehicleRow } from "../src/sheets/rowMapper.js";
import type { ExtractionResult } from "../src/ocr/types.js";

const meta = { timestamp: "2026-08-11T10:00:00Z", employeeName: "Nguyen Van A", employeeZaloId: "zalo-1" };

describe("rowMapper", () => {
  it("maps a vehicle_registration extraction to a sheet row", () => {
    const result: ExtractionResult = {
      documentType: "vehicle_registration",
      confidence: 0.9,
      vehicle: {
        vehiclePlate: "29A-123.45",
        vehicleType: "O to con",
        seatCount: "5",
        ownerName: "Le Van C",
        address: "",
        chassisNumber: "RLN2US",
        engineNumber: "1B22765",
        loadCapacity: "",
      },
      lowConfidenceFields: ["address"],
      rawText: "",
    };

    const row = toVehicleRow(result, meta);
    expect(row).toBeDefined();
    const r = row!;
    expect(r[0]).toBe(meta.timestamp);
    expect(r[3]).toBe("Dang ky xe");
    expect(r[4]).toBe("29A-123.45");
    expect(r[7]).toBe("Le Van C");
    expect(r[r.length - 1]).toBe("address");
  });

  it("maps an insurance extraction to a sheet row", () => {
    const result: ExtractionResult = {
      documentType: "insurance",
      confidence: 0.75,
      vehicle: {
        vehiclePlate: "30F-999.99",
        vehicleType: "O to con",
        seatCount: "4",
        ownerName: "Pham Thi D",
        address: "TP.HCM",
        chassisNumber: "",
        engineNumber: "",
        loadCapacity: "X",
      },
      lowConfidenceFields: [],
      rawText: "",
    };

    const row = toVehicleRow(result, meta);
    expect(row).toBeDefined();
    expect(row?.[3]).toBe("Bao hiem xe");
    expect(row?.[4]).toBe("30F-999.99");
    expect(row?.[7]).toBe("Pham Thi D");
  });

  it("returns undefined when there is no vehicle data (unknown documentType)", () => {
    const result: ExtractionResult = {
      documentType: "unknown",
      confidence: 0.1,
      lowConfidenceFields: [],
      rawText: "",
    };
    expect(toVehicleRow(result, meta)).toBeUndefined();
  });
});
