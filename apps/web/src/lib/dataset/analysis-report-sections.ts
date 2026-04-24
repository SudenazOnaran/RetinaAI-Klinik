import type { Prisma } from "@prisma/client";

export const REPORT_FORMAT_VERSION = "manual_report_v2" as const;
export const REPORT_SECTION_MAX_LEN = 1500;

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

export type AnalysisReportMetaInput = {
  aiIncluded: boolean;
  patientInfo: {
    fullName: string;
    tcNo: string;
    age: number | null;
    gender: string | null;
  };
  aiSummary: string;
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
