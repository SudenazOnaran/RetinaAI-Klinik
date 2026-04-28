type ReportT = (key: string, options?: Record<string, string | number>) => string;

/** OCT API yanıtı → rapor metni (muayene bulguları alanı). */
export function buildOctTextForReport(
  oct: {
    imageQuality: string;
    findings: string[];
    conditions: {
      name: string;
      likelihood: string;
      supportingFindings: string[];
      contradictingFindings: string[];
    }[];
    clinicalSummary: string;
    recommendations: string[];
  },
  analysisNotes: string,
  t: ReportT,
) {
  const likLabel = (k: string) => {
    const x = (k || "low").toLowerCase();
    if (x === "moderate") return t("octAnalysis.likelihoodModerate");
    if (x === "high") return t("octAnalysis.likelihoodHigh");
    return t("octAnalysis.likelihoodLow");
  };
  const lines: string[] = [
    "━━ " + t("aiAnalysisPanel.octBlockHeader") + " ━━",
  ];
  if (analysisNotes.trim()) {
    lines.push(
      `${t("radiologicalReport.analysisNotesHeading")}\n${analysisNotes.trim()}`,
    );
  }
  lines.push(
    `${t("octAnalysis.imageQuality")}: ${oct.imageQuality}`,
    "",
    t("octAnalysis.findings") + ":",
  );
  oct.findings.forEach((f) => lines.push(`• ${f}`));
  if (oct.conditions.length) {
    lines.push("", t("octAnalysis.conditions") + ":");
    for (const c of oct.conditions) {
      lines.push(
        `• ${c.name} — ${t("aiAnalysisPanel.likelihood")}: ${likLabel(c.likelihood)}`,
      );
      if (c.supportingFindings.length) {
        lines.push(`  ${t("octAnalysis.supporting")}: ${c.supportingFindings.join("; ")}`);
      }
      if (c.contradictingFindings.length) {
        lines.push(
          `  ${t("octAnalysis.contradicting")}: ${c.contradictingFindings.join("; ")}`,
        );
      }
    }
  }
  lines.push(
    "",
    `${t("octAnalysis.clinicalSummary")}: ${oct.clinicalSummary || "—"}`,
    "",
    `${t("octAnalysis.recommendations")}:`,
  );
  oct.recommendations.forEach((r, i) => lines.push(`${i + 1}. ${r}`));
  return lines.join("\n");
}

/** FFA API yanıtı → rapor metni. */
export function buildFfaTextForReport(
  ffa: {
    imageQuality: string;
    phaseAssessment: string;
    confidenceScore: number;
    findings: string[];
    diseases: {
      name: string;
      likelihood: string;
      supportingFindings: string[];
      contradictingFindings: string[];
    }[];
    diabeticRetinopathyFfa?: {
      stage: string;
      confidenceTier: string;
      rationale: string;
    } | null;
    activity: {
      activeDisease: string;
      neovascularization: string;
      leakage: string;
    };
    clinicalSummary: string;
    recommendations: string[];
  },
  analysisNotes: string,
  t: ReportT,
) {
  const likLabel = (k: string) => {
    const x = (k || "low").toLowerCase();
    if (x === "moderate") return t("ffaAnalysis.likelihoodModerate");
    if (x === "high") return t("ffaAnalysis.likelihoodHigh");
    return t("ffaAnalysis.likelihoodLow");
  };
  const lines: string[] = [
    "━━ " + t("aiAnalysisPanel.ffaBlockHeader") + " ━━",
  ];
  if (analysisNotes.trim()) {
    lines.push(
      `${t("radiologicalReport.analysisNotesHeading")}\n${analysisNotes.trim()}`,
    );
  }
  lines.push(
    `${t("ffaAnalysis.imageQuality")}: ${ffa.imageQuality}`,
    `${t("ffaAnalysis.phaseAssessment")}: ${ffa.phaseAssessment}`,
    `${t("ffaAnalysis.confidenceScore")}: ${
      Number.isFinite(ffa.confidenceScore) ? String(ffa.confidenceScore) : "—"
    }`,
    "",
    t("ffaAnalysis.findings") + ":",
  );
  ffa.findings.forEach((f) => lines.push(`• ${f}`));
  if (ffa.diseases.length) {
    lines.push("", t("ffaAnalysis.diseases") + ":");
    for (const c of ffa.diseases) {
      lines.push(
        `• ${c.name} — ${t("aiAnalysisPanel.likelihood")}: ${likLabel(c.likelihood)}`,
      );
      if (c.supportingFindings.length) {
        lines.push(`  ${t("ffaAnalysis.supporting")}: ${c.supportingFindings.join("; ")}`);
      }
      if (c.contradictingFindings.length) {
        lines.push(
          `  ${t("ffaAnalysis.contradicting")}: ${c.contradictingFindings.join("; ")}`,
        );
      }
    }
  }
  const drf = ffa.diabeticRetinopathyFfa;
  if (
    drf &&
    (drf.stage?.trim() ||
      drf.confidenceTier?.trim() ||
      drf.rationale?.trim())
  ) {
    lines.push(
      "",
      t("ffaAnalysis.drStagingTitle"),
      `${t("ffaAnalysis.drStagingStage")}: ${drf.stage?.trim() || "—"}`,
      `${t("ffaAnalysis.drStagingConfidence")}: ${drf.confidenceTier?.trim() || "—"}`,
      `${t("ffaAnalysis.drStagingRationale")}: ${drf.rationale?.trim() || "—"}`,
    );
  }
  lines.push(
    "",
    `${t("ffaAnalysis.activityTitle")}:`,
    `• ${t("ffaAnalysis.activeDisease")}: ${ffa.activity.activeDisease}`,
    `• ${t("ffaAnalysis.neovascularization")}: ${ffa.activity.neovascularization}`,
    `• ${t("ffaAnalysis.leakage")}: ${ffa.activity.leakage}`,
    "",
    `${t("ffaAnalysis.clinicalSummary")}: ${ffa.clinicalSummary || "—"}`,
    "",
    `${t("ffaAnalysis.recommendations")}:`,
  );
  ffa.recommendations.forEach((r, i) => lines.push(`${i + 1}. ${r}`));
  return lines.join("\n");
}
