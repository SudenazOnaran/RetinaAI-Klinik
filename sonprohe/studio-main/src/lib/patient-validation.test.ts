import { describe, expect, it } from "vitest";
import {
  validateCreatePatientInput,
  validateUpdatePatientClinicalInput,
} from "@/lib/patient-validation";

describe("patient validation", () => {
  it("accepts valid create payload", () => {
    const result = validateCreatePatientInput({
      fullName: "Test Hasta",
      tcNo: "10000000146",
      age: 52,
      gender: "Erkek",
      diabetesYears: 10,
      hba1c: 7.3,
    });

    expect(result.success).toBe(true);
  });

  it("rejects invalid tc number", () => {
    const result = validateCreatePatientInput({
      fullName: "Test Hasta",
      tcNo: "12345678901",
      age: 52,
      gender: "Erkek",
      diabetesYears: 10,
      hba1c: 7.3,
    });

    expect(result.success).toBe(false);
  });

  it("rejects out-of-range hba1c", () => {
    const result = validateUpdatePatientClinicalInput({
      age: 55,
      diabetesYears: 8,
      hba1c: 25,
    });

    expect(result.success).toBe(false);
  });

  it("accepts nullable clinical fields", () => {
    const result = validateUpdatePatientClinicalInput({
      age: 40,
      diabetesYears: null,
      hba1c: null,
    });

    expect(result.success).toBe(true);
  });
});
