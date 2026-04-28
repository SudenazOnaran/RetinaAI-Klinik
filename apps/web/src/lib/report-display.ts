/**
 * Muayene bulgulari metninden OCT/FFA ekleme bloglarini ayirir
 * (ai-modality-report-text.ts ciktisi ━━ ... ━━ ile baslar).
 */
export function splitExamFindingsWithModalities(examText: string) {
  const t = (examText || "").trim();
  if (!t) {
    return {
      core: "-",
      oct: null as string | null,
      ffa: null as string | null,
      full: "",
    };
  }
  const parts = t.split(/(?=^━━\s)/m);
  const core = (parts[0] || "").trim() || "-";
  const oct: string[] = [];
  const ffa: string[] = [];
  for (let i = 1; i < parts.length; i++) {
    const block = parts[i].trim();
    if (!block) continue;
    if (/\bOCT\b/i.test(block)) oct.push(block);
    else if (/\bFFA\b/i.test(block)) ffa.push(block);
  }
  return {
    core,
    oct: oct.length ? oct.join("\n\n") : null,
    ffa: ffa.length ? ffa.join("\n\n") : null,
    full: t,
  };
}

const MANUAL_REPORT_V2 = "manual_report_v2" as const;

/**
 * Klinik muayene (DB `sectionExamFindings` / JSON sections.examFindings) ile
 * OCT/FFA eklentilerini birlestirir. Yeni kayit: eklentiler `modalityAppendix*`;
 * eski: tek alanda `splitExamFindingsWithModalities` ile ayrıştırma.
 */
export function resolveExamAndModalityText(
  sectionExamFromDb: string | null | undefined,
  doctorNote: string | null | undefined,
): {
  clinicalExam: string;
  oct: string | null;
  ffa: string | null;
} {
  let structured: Record<string, unknown> | null = null;
  try {
    if (doctorNote) structured = JSON.parse(doctorNote) as Record<string, unknown>;
  } catch {
    structured = null;
  }
  const isV2 = structured?.version === MANUAL_REPORT_V2;
  const hasModalityKeys =
    structured != null &&
    ("modalityAppendixOct" in structured || "modalityAppendixFfa" in structured);
  const examCol = (sectionExamFromDb && String(sectionExamFromDb).trim()) || "";
  const secExam = (() => {
    const s = structured?.sections;
    if (s && typeof s === "object" && !Array.isArray(s) && "examFindings" in s) {
      return String(
        (s as { examFindings?: string }).examFindings || "",
      ).trim();
    }
    return "";
  })();

  if (isV2 && hasModalityKeys) {
    const oct = String(structured?.modalityAppendixOct ?? "").trim();
    const ffa = String(structured?.modalityAppendixFfa ?? "").trim();
    const clinical = (examCol || secExam).trim() || "Belirtilmedi";
    return {
      clinicalExam: clinical,
      oct: oct || null,
      ffa: ffa || null,
    };
  }
  const combined = examCol || secExam;
  const split = splitExamFindingsWithModalities(
    combined && combined !== "Belirtilmedi" ? combined : "",
  );
  return {
    clinicalExam: split.core,
    oct: split.oct,
    ffa: split.ffa,
  };
}

/** Gecmis raporlar listesinde onizleme; PDF/Ozet tam metin. */
export function clipReportListPreview(
  text: string,
  max = 220,
  emptyFallback = "-",
): string {
  const s = String(text ?? "").trim();
  if (!s) return emptyFallback;
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}
