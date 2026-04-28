import { isDoctorApprovalToken } from "@/lib/doctor-feedback";

type ReportLike = {
  originalImage?: string | null;
  heatmapUrl?: string | null;
  aiResult?: string | null;
  drFeedback?: unknown;
  doctorNote?: string | null;
  sectionClinicalAssessment?: string | null;
};

function parseDoctorFeedbackFirstLine(drFeedback: ReportLike["drFeedback"]): string | null {
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

function clinicalFromStructuredDoctorNote(doctorNote: string | null | undefined): string | null {
  if (!doctorNote) return null;
  try {
    const o = JSON.parse(doctorNote) as {
      version?: string;
      sections?: { clinicalAssessment?: string };
    };
    if (o?.version === "manual_report_v2") {
      const v = o.sections?.clinicalAssessment?.trim();
      if (v && v !== "-" && v !== "—") return v;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * PDF ve hasta ekranı için “nihai tanı satırı”: fundus görüntüsü yoksa `aiResult`
 * (çoğu zaman hasta özet DR’si) fundus tanısı gibi gösterilmez.
 */
export function resolveClinicalFinalLabelForReport(report: ReportLike): string {
  const rawFb = parseDoctorFeedbackFirstLine(report.drFeedback);
  if (rawFb && typeof rawFb === "string") {
    const lines = rawFb
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const meaningful = lines.find((line) => !isDoctorApprovalToken(line));
    if (meaningful) return meaningful;
  }

  const hasFundusEvidence =
    Boolean(String(report.originalImage ?? "").trim()) ||
    Boolean(String(report.heatmapUrl ?? "").trim());

  if (hasFundusEvidence && report.aiResult?.trim()) {
    return report.aiResult.trim();
  }

  const sec = report.sectionClinicalAssessment?.trim();
  if (sec && sec !== "-" && sec !== "—") return sec;

  const fromNote = clinicalFromStructuredDoctorNote(report.doctorNote ?? undefined);
  if (fromNote) return fromNote;

  return "—";
}
