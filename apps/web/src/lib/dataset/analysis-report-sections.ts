import type { Prisma } from "@prisma/client";

export const REPORT_FORMAT_VERSION = "manual_report_v2" as const;
/** Manuel rapor metin alanlari (OCT/AI ciktisi icin yeterli ust sinir) */
export const REPORT_SECTION_MAX_LEN = 8000;
/** AI analiz kartları — opsiyonel hekim notu */
export const ANALYSIS_NOTES_MAX_LEN = 1500;
/** Legacy `Analysis.ilaclar` sütunu; tam tedavi metni `sectionTreatmentRecommendations` içinde kalir */
export const ILACLAR_COLUMN_MAX_LEN = 1500;

export type AnalysisReportSectionsInput = {
  reportTitle: string;
  reportDate: string;
  doctorDisplayName: string;
  anamnesis: string;
  examFindings: string;
  labResults: string;
  clinicalAssessment: string;
  treatmentRecommendations: string;
  doctorNotes: string;
};

/** Prisma enum ile uyumlu; JSON ve meta için ortak isim */
export type AnalysisReportKindValue =
  | "clinical_manual"
  | "radiological_ai";

export type AnalysisReportMetaInput = {
  aiIncluded: boolean;
  patientInfo: {
    fullName: string;
    tcNo: string;
    age: number | null;
    gender: string | null;
  };
  aiSummary: string;
  /** Kayıt türü; klinik form vs AI/radyoloji sekmesi */
  reportKind?: AnalysisReportKindValue;
  /** OCT/FFA rapor metninin muayene alanına karışmaması için ayrı JSON alanları */
  modalityAppendixOct?: string;
  modalityAppendixFfa?: string;
};

const MAX_COMORBIDITY_JSON = 24_000;

export function parseComorbidityJsonForStorage(
  raw: unknown,
): Prisma.InputJsonValue | undefined {
  if (raw == null) return undefined;
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return undefined;
  }
  try {
    const s = JSON.stringify(raw);
    if (s.length > MAX_COMORBIDITY_JSON) return undefined;
  } catch {
    return undefined;
  }
  return raw as Prisma.InputJsonValue;
}

/** Eski PDF/parseStructuredReport uyumu icin doctorNote JSON uretir */
export function buildManualReportV2DoctorNoteJson(
  sections: AnalysisReportSectionsInput,
  meta: AnalysisReportMetaInput,
): string {
  return JSON.stringify({
    version: REPORT_FORMAT_VERSION,
    reportKind: meta.reportKind,
    reportTitle: sections.reportTitle,
    reportDate: sections.reportDate,
    aiIncluded: meta.aiIncluded,
    patientInfo: meta.patientInfo,
    doctorName: sections.doctorDisplayName,
    sections: {
      anamnesis: sections.anamnesis,
      examFindings: sections.examFindings,
      labResults: sections.labResults,
      clinicalAssessment: sections.clinicalAssessment,
      treatmentRecommendations: sections.treatmentRecommendations,
    },
    doctorNotes: sections.doctorNotes,
    aiSummary: meta.aiSummary,
    modalityAppendixOct: meta.modalityAppendixOct?.trim() ?? "",
    modalityAppendixFfa: meta.modalityAppendixFfa?.trim() ?? "",
  });
}

export function getFirstExceededReportSection(
  sections: AnalysisReportSectionsInput,
  labels: Record<keyof AnalysisReportSectionsInput, string>,
): { label: string; length: number } | null {
  const entries = Object.entries(sections) as [keyof AnalysisReportSectionsInput, string][];
  for (const [key, value] of entries) {
    const len = String(value || "").length;
    if (len > REPORT_SECTION_MAX_LEN) {
      return { label: labels[key], length: len };
    }
  }
  return null;
}
