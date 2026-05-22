import {
  decodeModalityAiAlignedLabel,
  decodeOctMultiSelection,
  isDoctorApprovalToken,
} from "@/lib/doctor-feedback";
import { ANTERIOR_SEGMENT_DISEASE_KEYS } from "@/lib/modality-risk-surface";

type TFn = (key: string, options?: Record<string, string | number>) => string;

/** Tablo / rapor özetinde doktor geri bildirimini okunur metne çevirir. */
export function humanizeAnteriorSegmentDoctorFeedback(
  raw: string | null | undefined,
  t: TFn,
): string {
  const value = String(raw ?? "").trim();
  if (!value) return "—";

  const aligned = decodeModalityAiAlignedLabel(value);
  if (aligned) {
    return `${t("anteriorSegmentHistory.feedbackAgreePrefix")}: ${aligned}`;
  }

  if (isDoctorApprovalToken(value)) {
    return t("anteriorSegmentHistory.feedbackAgreeAi");
  }

  const multi = decodeOctMultiSelection(value);
  if (multi.length > 0) {
    const labels = multi.map((code) => {
      const hit = ANTERIOR_SEGMENT_DISEASE_KEYS.find((k) => k.value === code);
      if (hit) return t(`modalityDisagree.anteriorSegment.${hit.value}`);
      return code;
    });
    return `${t("anteriorSegmentHistory.feedbackCorrectionPrefix")}: ${labels.join(", ")}`;
  }

  const byCode = ANTERIOR_SEGMENT_DISEASE_KEYS.find((k) => k.value === value);
  if (byCode) {
    return t(`modalityDisagree.anteriorSegment.${byCode.value}`);
  }

  return value.slice(0, 400);
}

function displayStatus(status: string, t: TFn): string {
  const s = String(status || "")
    .trim()
    .toLowerCase();
  if (s === "present") return t("anteriorSegmentAnalysis.statusPresent");
  if (s === "possibly_present") return t("anteriorSegmentAnalysis.statusPossiblyPresent");
  if (s === "limited_assessment") return t("anteriorSegmentAnalysis.statusLimitedAssessment");
  return t("anteriorSegmentAnalysis.statusNotDetected");
}

/** Ön segment AI yanıtı → kayıt / tablo metni. */
export function buildAnteriorSegmentTextForReport(
  payload: {
    imageQuality: { qualityScore: number; issues: string[] };
    detectedFindings: string[];
    diseaseAssessment: {
      disease: string;
      status: string;
      confidence: number;
      supportingFindings: string[];
      evaluatedStructures: string[];
    }[];
    urgentReferralNeeded: boolean;
    urgentReasons: string[];
    overallSummary: string;
  },
  analysisNotes: string,
  t: TFn,
) {
  const lines: string[] = [
    "━━ " + t("anteriorSegmentHistory.reportBlockHeader") + " ━━",
  ];

  if (analysisNotes.trim()) {
    lines.push(
      `${t("radiologicalReport.analysisNotesHeading")}\n${analysisNotes.trim()}`,
    );
  }

  lines.push(
    `${t("anteriorSegmentAnalysis.imageQuality")}: ${payload.imageQuality.qualityScore || "—"}`,
  );
  if (payload.imageQuality.issues.length) {
    lines.push(`${t("anteriorSegmentHistory.qualityIssues")}: ${payload.imageQuality.issues.join("; ")}`);
  }

  if (payload.overallSummary.trim()) {
    lines.push("", `${t("anteriorSegmentAnalysis.overallSummary")}: ${payload.overallSummary.trim()}`);
  }

  if (payload.detectedFindings.length) {
    lines.push("", `${t("anteriorSegmentAnalysis.detectedFindings")}:`);
    payload.detectedFindings.forEach((f) => lines.push(`• ${f}`));
  }

  if (payload.diseaseAssessment.length) {
    lines.push("", `${t("anteriorSegmentAnalysis.diseaseAssessment")}:`);
    for (const row of payload.diseaseAssessment) {
      lines.push(
        `• ${row.disease} — ${displayStatus(row.status, t)} (%${Number(row.confidence || 0).toFixed(0)})`,
      );
      if (row.supportingFindings.length) {
        lines.push(`  ${t("anteriorSegmentAnalysis.supporting")}: ${row.supportingFindings.join("; ")}`);
      }
      if (row.evaluatedStructures.length) {
        lines.push(
          `  ${t("anteriorSegmentAnalysis.evaluatedStructures")}: ${row.evaluatedStructures.join(", ")}`,
        );
      }
    }
  }

  if (payload.urgentReferralNeeded) {
    lines.push("", t("anteriorSegmentAnalysis.urgentReferralTitle"));
    payload.urgentReasons.forEach((r) => lines.push(`• ${r}`));
  }

  return lines.join("\n");
}
