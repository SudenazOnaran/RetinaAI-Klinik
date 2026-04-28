import type { AnalysisReportKindValue } from "@/lib/dataset/analysis-report-sections";

export type ResolvedReportKind = AnalysisReportKindValue;

export type AnalysisReportKindInput = {
  /** Prisma enum veya serbest string (legacy); çözümleme `resolveReportKind` içinde yapılır */
  reportKind?: AnalysisReportKindValue | string | null;
  doctorNote?: string | null;
  originalImage?: string | null;
  heatmapUrl?: string | null;
  octImageUrl?: string | null;
  ffaImageUrl?: string | null;
};

type StructuredV2 = {
  version?: string;
  reportKind?: AnalysisReportKindValue;
  aiIncluded?: boolean;
};

export function parseManualReportV2Json(
  doctorNote: string | null | undefined,
): StructuredV2 | null {
  if (!doctorNote) return null;
  try {
    const parsed = JSON.parse(doctorNote) as StructuredV2;
    if (parsed?.version === "manual_report_v2") return parsed;
    return null;
  } catch {
    return null;
  }
}

/**
 * DB `reportKind`, JSON `reportKind` veya görüntü/legacy kurallarıyla kayıt türünü çözümler.
 */
export function resolveReportKind(
  analysis: AnalysisReportKindInput,
): ResolvedReportKind {
  if (analysis.reportKind === "clinical_manual") {
    return "clinical_manual";
  }
  if (analysis.reportKind === "radiological_ai") {
    return "radiological_ai";
  }

  const s = parseManualReportV2Json(analysis.doctorNote);
  if (s?.reportKind === "clinical_manual") {
    return "clinical_manual";
  }
  if (s?.reportKind === "radiological_ai") {
    return "radiological_ai";
  }

  const hasImage = Boolean(
    analysis.originalImage ||
      analysis.heatmapUrl ||
      analysis.octImageUrl ||
      analysis.ffaImageUrl,
  );
  if (hasImage) {
    return "radiological_ai";
  }

  if (s?.version === "manual_report_v2") {
    if (s.aiIncluded === true) {
      return "radiological_ai";
    }
    return "clinical_manual";
  }

  // Eski düz metin notlar, görüntü yok → klinik kabul
  if (!hasImage && analysis.doctorNote && !s) {
    return "clinical_manual";
  }

  return "radiological_ai";
}

export function isClinicalReport(analysis: AnalysisReportKindInput): boolean {
  return resolveReportKind(analysis) === "clinical_manual";
}

export function isRadiologicalReport(
  analysis: AnalysisReportKindInput,
): boolean {
  return resolveReportKind(analysis) === "radiological_ai";
}

/**
 * Yalnızca «AI ve görüntü analizi» akışından kaydedilen satırlar (tab/sekme ile uyumlu).
 * Eski kayıtlar: `manual_report_v2` + aiIncluded + görüntü.
 */
export function isRadiologicalAiWorkflowReport(
  analysis: AnalysisReportKindInput,
): boolean {
  if (analysis.reportKind === "radiological_ai") return true;
  const s = parseManualReportV2Json(analysis.doctorNote);
  if (s?.reportKind === "radiological_ai") return true;
  if (
    s?.version === "manual_report_v2" &&
    s.aiIncluded === true &&
    Boolean(
      analysis.originalImage ||
        analysis.heatmapUrl ||
        analysis.octImageUrl ||
        analysis.ffaImageUrl,
    )
  ) {
    return true;
  }
  return false;
}
