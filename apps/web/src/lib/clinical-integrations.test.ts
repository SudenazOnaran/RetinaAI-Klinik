import { describe, expect, it } from "vitest";
import { buildFhirBundle, buildHbysPayload } from "@/lib/clinical-integrations";

describe("clinical-integrations mappers", () => {
  const patient = {
    id: "pat_1",
    doctorId: "doc_1",
    fullName: "Ayse Demir",
    tcNo: "12345678901",
    age: 57,
    gender: "Kadın",
    diabetesYears: 12,
    hba1c: 7.8,
    risk: "Yuksek",
    latestAnalysis: {
      id: "an_1",
      aiResult: "Moderate",
      confidence: 0.88,
      drFeedback: "Severe",
      doctorNote: "Makulada odak odem supheli",
      actualResult: null,
      createdAt: new Date("2026-03-01T10:00:00.000Z"),
    },
  };

  it("builds FHIR bundle with patient and observation entries", () => {
    const bundle = buildFhirBundle(patient, "Dr. Test");

    expect(bundle.resourceType).toBe("Bundle");
    expect(Array.isArray(bundle.entry)).toBe(true);
    expect(bundle.entry.length).toBeGreaterThanOrEqual(2);

    const patientResource = bundle.entry[0].resource as {
      resourceType: string;
    };
    expect(patientResource.resourceType).toBe("Patient");
  });

  it("builds HBYS payload including final diagnosis and confidence", () => {
    const payload = buildHbysPayload(patient, "Dr. Test");

    expect(payload.kaynak).toBe("retina-clinic");
    expect(payload.hasta.tcNo).toBe("12345678901");
    expect(payload.analiz?.finalSonuc).toBe("Severe");
    expect(payload.analiz?.guvenSkoru).toBe(0.88);
  });
});
