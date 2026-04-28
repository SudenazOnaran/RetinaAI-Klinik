/**
 * Sunucu tarafında DB kayıtlarından RetinaReportPdfInput üretir (hasta detayı ile aynı mantık).
 */

import type { Analysis, Doctor, Patient } from "@prisma/client";
import { isDoctorApprovalToken } from "@/lib/doctor-feedback";
import { resolveAbsoluteMediaUrlForPdf } from "@/lib/pdf-media-url";
import type { RetinaReportPdfInput } from "@/lib/retina-report-pdf-types";
import { resolveClinicalFinalLabelForReport } from "@/lib/report-clinical-final-label";
import type { RetinaSettings } from "@/lib/retina-settings";
function parseStructuredReport(value: string | null | undefined) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as {
      version?: string;
      aiIncluded?: boolean;
      aiSummary?: string;
      sections?: Record<string, string | undefined>;
      reportTitle?: string;
      reportDate?: string;
      doctorName?: string;
    };
    if (parsed?.version === "manual_report_v2") return parsed;
    return null;
  } catch {
    return null;
  }
}

function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getLegacyFieldValue(note: string | null | undefined, label: string) {
  if (!note) return null;
  const prefix = `${label}:`;
  const line = note
    .split("\n")
    .map((v) => v.trim())
    .find((v) => v.startsWith(prefix));
  if (!line) return null;
  return line.slice(prefix.length).trim() || null;
}

function parseDoctorFeedback(drFeedback: Analysis["drFeedback"]): string | null {
  if (drFeedback == null) return null;
  if (Array.isArray(drFeedback)) {
    const firstValid = drFeedback.find((v) => v !== null && v !== "null");
    return firstValid != null ? String(firstValid) : null;
  }
  if (typeof drFeedback === "string" && drFeedback !== "null") {
    return drFeedback;
  }
  return null;
}

function getReportSectionValue(
  report: Analysis,
  sectionKey:
    | "anamnesis"
    | "examFindings"
    | "labResults"
    | "clinicalAssessment"
    | "treatmentRecommendations",
  legacyLabel: string,
  fallback = "-",
): string {
  const dbColumn: Record<string, keyof Analysis> = {
    anamnesis: "sectionAnamnesis",
    examFindings: "sectionExamFindings",
    labResults: "sectionLabResults",
    clinicalAssessment: "sectionClinicalAssessment",
    treatmentRecommendations: "sectionTreatmentRecommendations",
  };
  const col = dbColumn[sectionKey];
  const fromDb = report[col];
  if (typeof fromDb === "string" && fromDb.trim()) {
    return fromDb;
  }

  const structured = parseStructuredReport(report.doctorNote);
  const structuredValue = structured?.sections?.[sectionKey];
  if (typeof structuredValue === "string" && structuredValue.trim()) {
    return structuredValue;
  }

  const legacyValue = getLegacyFieldValue(report.doctorNote, legacyLabel);
  if (legacyValue) return legacyValue;

  return fallback;
}

function getTreatmentText(report: Analysis): string {
  const sectionValue = getReportSectionValue(
    report,
    "treatmentRecommendations",
    "Tedavi ve Öneriler",
    "",
  );
  if (sectionValue) return sectionValue;
  return report.ilaclar || "-";
}

export function buildRetinaReportPdfInputFromDb(params: {
  patient: Patient & { doctor: Doctor | null };
  analysis: Analysis;
  pdfVariant: "clinical" | "radiological";
  pdfLocale: "tr" | "en";
  retinaSettingsSnapshot?: RetinaSettings | null;
}): RetinaReportPdfInput {
  const { patient, analysis: report, pdfVariant, pdfLocale } = params;

  const labels = parseJsonArray(report.aiOdriLabels);
  const confidences = parseJsonArray(report.aiOdriConfidences);
  const odirResults = labels.map((label: string, idx: number) => ({
    label,
    confidence: Number(confidences[idx] ?? 0),
  }));

  const structured = parseStructuredReport(report.doctorNote);
  const drFb = parseDoctorFeedback(report.drFeedback);

  const doctorName = patient.doctor
    ? `${patient.doctor.name} ${patient.doctor.surname}`.trim()
    : undefined;

  return {
    patientId: patient.id,
    patientInfo: {
      fullName: patient.fullName,
      tcNo: patient.tcNo,
      age: patient.age,
    },
    doctorName,
    reportDate: report.createdAt,
    aiResult: report.aiResult,
    confidence: Number(report.confidence ?? 0),
    odirResults,
    clinicalFinalResult: resolveClinicalFinalLabelForReport(report),
    doctorFeedback:
      drFb && !isDoctorApprovalToken(drFb) ? drFb : undefined,
    doctorNote: report.doctorNote ?? undefined,
    medications: getTreatmentText(report),
    originalImage: resolveAbsoluteMediaUrlForPdf(report.originalImage),
    heatmapUrl: resolveAbsoluteMediaUrlForPdf(report.heatmapUrl),
    octImageUrl: resolveAbsoluteMediaUrlForPdf(report.octImageUrl),
    ffaImageUrl: resolveAbsoluteMediaUrlForPdf(report.ffaImageUrl),
    reportTitle: report.reportTitle ?? structured?.reportTitle,
    reportDateLabel: report.reportDateKey ?? structured?.reportDate,
    reportDoctorDisplayName:
      report.reportDoctorDisplayName ?? structured?.doctorName,
    fundusModalityActive:
      Boolean(String(report.originalImage ?? "").trim()) ||
      Boolean(String(report.heatmapUrl ?? "").trim()),
    sectionAnamnesis: report.sectionAnamnesis,
    sectionExamFindings: report.sectionExamFindings,
    sectionLabResults: report.sectionLabResults,
    sectionClinicalAssessment: report.sectionClinicalAssessment,
    sectionTreatmentRecommendations: report.sectionTreatmentRecommendations,
    sectionDoctorNotes: report.sectionDoctorNotes,
    pdfVariant,
    pdfLocale,
    retinaSettingsSnapshot: params.retinaSettingsSnapshot ?? undefined,
  };
}
