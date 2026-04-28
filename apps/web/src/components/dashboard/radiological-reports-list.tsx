"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useTranslation } from "@/components/providers/i18n-provider";
import {
  clipReportListPreview,
  resolveExamAndModalityText,
} from "@/lib/report-display";
import {
  formatDrLabelForDisplay,
  getStorageDrLabel,
} from "@/lib/dr-stage-labels";
import { isDoctorApprovalToken } from "@/lib/doctor-feedback";
import { humanizeFfaDoctorFeedbackForSummary } from "@/lib/ffa-doctor-feedback-display";
import type { AiInferenceSnapshot } from "@/lib/dataset/snapshot";
import { ChevronDown, X } from "lucide-react";

/** Özet satırı (tam AI metni collapsible içinde) */
const RESULT_SNIPPET_MAX = 240;

function parseJsonArray(value: string | null | undefined): unknown[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseStructuredReport(value: string | null | undefined) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (parsed?.version === "manual_report_v2") {
      return parsed;
    }
    return null;
  } catch {
    return null;
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

function isAiIncludedInReport(report: any) {
  const structured = parseStructuredReport(report?.doctorNote);
  if (typeof structured?.aiIncluded === "boolean") {
    return structured.aiIncluded;
  }

  const summaryText = String(structured?.aiSummary || "")
    .trim()
    .toLocaleLowerCase("tr-TR");

  if (summaryText.includes("ai analizi eklenmedi")) {
    return false;
  }

  return Boolean(report?.originalImage || report?.heatmapUrl);
}

function getDoctorFeedback(report: any) {
  const feedback = report?.drFeedback;

  if (Array.isArray(feedback)) {
    const firstValid = feedback.find((v) => v !== null && v !== "null");
    return firstValid ?? null;
  }

  if (typeof feedback === "string" && feedback !== "null") {
    return feedback;
  }

  return null;
}

function readInferenceJson(report: any): AiInferenceSnapshot | null {
  const raw = report?.aiInferenceJson;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as AiInferenceSnapshot;
}

function stripLeadingModalityHeader(text: string): string {
  return text.replace(/^━━[^\n]*━━\s*\n?/m, "").trim();
}

function extractAnalysisNotesBlock(
  full: string | undefined | null,
  heading: string,
): string | null {
  const body = String(full ?? "").trim();
  if (!body || !heading.trim()) return null;
  const esc = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(
    `${esc}\\s*:?\\s*\\n([\\s\\S]*?)(?=\\n━━|\\n${esc}|$)`,
    "i",
  );
  const m = body.match(re);
  const chunk = m?.[1]?.trim();
  if (!chunk) return null;
  return chunk.split(/\n━━/)[0]?.trim() || chunk;
}

function extractFundusPipeNotes(
  aiSummary: string | undefined,
  noteTagTr: string,
  noteTagEn: string,
): string | null {
  const s = String(aiSummary ?? "");
  for (const tag of [noteTagTr, noteTagEn]) {
    const needle = `${tag}:`;
    const idx = s.indexOf(needle);
    if (idx >= 0) {
      const rest = s.slice(idx + needle.length).trim();
      const pipe = rest.split("|")[0]?.trim();
      return pipe || null;
    }
  }
  return null;
}

/** Collapsible içinde tam metin (kısaltma yok) */
function buildFundusAiNarrativeFull(params: {
  inference: AiInferenceSnapshot | null;
  structuredAiSummary: string | undefined;
}): string {
  const parts: string[] = [];
  const snap = params.inference;
  if (snap?.clinicalReasoning?.trim()) parts.push(snap.clinicalReasoning.trim());
  if (snap?.uncertaintyNote?.trim()) parts.push(snap.uncertaintyNote.trim());
  const summaryLine = String(params.structuredAiSummary ?? "").trim();
  if (summaryLine) parts.push(summaryLine);
  return parts.join("\n\n").trim() || "—";
}

function octResultSummaryLine(octFull: string): string {
  const body = stripLeadingModalityHeader(octFull);
  if (!body) return "-";
  const lines = body
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const pick = lines.find(
    (l) =>
      /^•/.test(l) &&
      (/—|olasılık|Likelihood|moderate|yüksek|düşük|high|low/i.test(l) ||
        /%/.test(l)),
  );
  if (pick) return clipReportListPreview(pick, RESULT_SNIPPET_MAX);
  return clipReportListPreview(lines.slice(0, 6).join("\n"), RESULT_SNIPPET_MAX);
}

function ffaConfidenceSnippet(ffaFull: string): string {
  const body = stripLeadingModalityHeader(ffaFull);
  if (!body) return "-";
  const line = body
    .split("\n")
    .map((l) => l.trim())
    .find((l) =>
      /confidence|güven|Güven|skor|score/i.test(l),
    );
  return line
    ? clipReportListPreview(line, RESULT_SNIPPET_MAX)
    : clipReportListPreview(body.split("\n").slice(0, 5).join("\n"), RESULT_SNIPPET_MAX);
}

/** Analiz notları blokunu çıkarır; AI metninin tamamını döndürür */
function modalityAiTextFullMinusNotes(
  full: string | null | undefined,
  heading: string,
): string {
  if (!full?.trim()) return "—";
  let body = stripLeadingModalityHeader(full);
  if (heading.trim()) {
    body = body
      .replace(
        new RegExp(
          `${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:?\\s*\\n[\\s\\S]*?(?=\\n━━|$)`,
          "i",
        ),
        "",
      )
      .trim();
  }
  const result = (body || stripLeadingModalityHeader(full)).trim();
  return result || "—";
}

function doctorFeedbackLinesForDisplay(raw: unknown): string[] {
  if (raw == null || raw === "null") return [];
  const s = String(raw).trim();
  if (!s) return [];
  return s.split("\n").map((l) => l.trim()).filter(Boolean);
}

function ZoomableReportImage({
  src,
  alt,
  width,
  height,
  className,
  imgClassName,
  onOpen,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  imgClassName?: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      className={`cursor-zoom-in text-left ${className ?? ""}`}
      onClick={(e) => {
        e.preventDefault();
        onOpen();
      }}
    >
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        unoptimized
        className={imgClassName}
      />
    </button>
  );
}

function NarrativeCollapsible({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Collapsible
      defaultOpen={false}
      className="rounded-lg border border-slate-100 bg-slate-50/80"
    >
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-slate-100/80">
        <span className="text-[11px] font-semibold text-slate-600">{title}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t border-slate-100 px-3 pb-3 pt-2">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

type Props = {
  reports: any[];
  patient: any;
  getReportAccentClass: (index: number) => string;
  onPreviewPdf: (report: any) => void;
};

export function RadiologicalReportsList({
  reports,
  patient,
  getReportAccentClass,
  onPreviewPdf,
}: Props) {
  const { t, locale } = useTranslation();

  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxSrc(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const resolveAiOnlyDiagnosis = (report: any) => {
    if (report?.aiResult) return report.aiResult;
    return getStorageDrLabel(0, locale);
  };

  const formatDiagnosisLabel = (label: string) =>
    formatDrLabelForDisplay(label, locale);

  const analysisNotesHeading = t("radiologicalReport.analysisNotesHeading");
  const noteTagTr = t("radiologicalReport.analysisNotesSummaryTag");

  return (
    <>
      <Card className="border border-[#d8e0df] bg-white shadow-sm">
      <CardHeader className="border-b border-slate-100 bg-[#f8faf9]">
        <CardTitle>{t("patientDetail.tabRadiologicalReports")}</CardTitle>
        <CardDescription>
          {t("patientDetailReports.radiologicalAiTabOnly", {
            count: reports.length,
          })}
        </CardDescription>
      </CardHeader>

      <CardContent className="min-w-0 space-y-4 overflow-x-hidden pt-4">
        {[...reports]
          .sort(
            (a: any, b: any) =>
              new Date(b.createdAt).getTime() -
              new Date(a.createdAt).getTime(),
          )
          .map((r: any, idx: number) => {
            const odirLabels = parseJsonArray(r.aiOdriLabels) as string[];
            const odirConfs = parseJsonArray(r.aiOdriConfidences) as number[];
            const hasAiAnalysis = isAiIncludedInReport(r);
            const aiRiskLabel = hasAiAnalysis
              ? formatDiagnosisLabel(resolveAiOnlyDiagnosis(r))
              : "-";
            const aiConfidenceLabel =
              hasAiAnalysis && Number.isFinite(Number(r.confidence))
                ? `%${Math.round(Number(r.confidence) * 100)}`
                : "-";

            const doctorFeedbackRaw = getDoctorFeedback(r);
            const fundusFeedbackLines = doctorFeedbackLinesForDisplay(
              doctorFeedbackRaw,
            ).filter((line) => !isDoctorApprovalToken(line));

            const structuredR = parseStructuredReport(r.doctorNote);
            const reportTitleLine =
              (typeof r.reportTitle === "string" && r.reportTitle.trim()) ||
              (typeof structuredR?.reportTitle === "string" &&
                String(structuredR.reportTitle).trim()) ||
              t("radiologicalReport.defaultTitle");
            const reportDoctorLine =
              (typeof r.reportDoctorDisplayName === "string" &&
                r.reportDoctorDisplayName.trim()) ||
              (typeof structuredR?.doctorName === "string" &&
                String(structuredR.doctorName).trim()) ||
              patient?.doctor?.name ||
              "—";

            const resolvedExam = resolveExamAndModalityText(
              r.sectionExamFindings,
              r.doctorNote,
            );
            const octText = resolvedExam.oct;
            const ffaText = resolvedExam.ffa;

            const fundusOdirLine =
              odirLabels.length > 0
                ? odirLabels
                    .map(
                      (label: string, i: number) =>
                        `${label} (%${Math.round(Number(odirConfs[i] ?? 0) * 100)})`,
                    )
                    .join(", ")
                : "";

            const inference = readInferenceJson(r);
            const globalDoctorNotesRaw =
              (typeof r.sectionDoctorNotes === "string" &&
                r.sectionDoctorNotes.trim()) ||
              (structuredR &&
                typeof structuredR.doctorNotes === "string" &&
                structuredR.doctorNotes.trim()) ||
              getLegacyFieldValue(r?.doctorNote, "Doktor Notları") ||
              "";
            const globalDoctorNotes =
              globalDoctorNotesRaw.trim() &&
              globalDoctorNotesRaw.trim() !== "-" &&
              globalDoctorNotesRaw.trim() !== "—"
                ? globalDoctorNotesRaw.trim()
                : "";

            const fundusAiSummaryLine =
              typeof structuredR?.aiSummary === "string"
                ? structuredR.aiSummary
                : "";

            const fundusAnalysisNotesFromSummary = extractFundusPipeNotes(
              fundusAiSummaryLine,
              noteTagTr,
              "Analysis notes",
            );

            const showFundus =
              Boolean(r.originalImage?.trim() || r.heatmapUrl?.trim()) ||
              odirLabels.length > 0;

            const showOct = Boolean(r.octImageUrl || octText);
            const showFfa = Boolean(r.ffaImageUrl || ffaText);

            const octFb =
              typeof r.octDrFeedback === "string"
                ? r.octDrFeedback.trim()
                : "";
            const ffaFb =
              typeof r.ffaDrFeedback === "string"
                ? r.ffaDrFeedback.trim()
                : "";
            const ffaFbDisplay = ffaFb
              ? humanizeFfaDoctorFeedbackForSummary(
                  ffaFb,
                  locale === "en" ? "en" : "tr",
                )
              : "";

            const octNotesExtracted = octText
              ? extractAnalysisNotesBlock(octText, analysisNotesHeading)
              : null;
            const ffaNotesExtracted = ffaText
              ? extractAnalysisNotesBlock(ffaText, analysisNotesHeading)
              : null;

            return (
              <div
                key={r.id}
                className={`max-w-full min-w-0 overflow-hidden rounded-xl border border-slate-200 border-l-4 p-4 shadow-sm ${getReportAccentClass(idx)}`}
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className="border-slate-300 bg-white text-slate-700"
                    >
                      {t("patientDetailReports.reportNo", {
                        no: reports.length - idx,
                      })}
                    </Badge>
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {t("patientDetailReports.dateLabel")}
                    </span>
                    <Badge className="bg-slate-700 text-white">
                      {format(new Date(r.createdAt), "dd MMM yyyy", {
                        locale: locale === "en" ? undefined : tr,
                      })}
                    </Badge>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-[#b8ccd6] text-[#355769] transition-colors hover:border-[#91afbd] hover:bg-[#edf6fb] hover:text-[#24485d]"
                    onClick={() => onPreviewPdf(r)}
                  >
                    {t("patientDetailReports.viewPdf")}
                  </Button>
                </div>

                <div className="mb-3 space-y-1">
                  <p className="text-sm font-semibold text-slate-900">
                    {t("patientDetailReports.reportTitle")}: {reportTitleLine}
                  </p>
                  <p className="text-xs text-slate-600">
                    {t("patientDetailReports.reportingDoctor")}:{" "}
                    {reportDoctorLine}
                  </p>
                </div>

                {globalDoctorNotes ? (
                  <div className="mb-4 rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      {t("patientDetailReports.generalDoctorNotes")}
                    </p>
                    <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800 [overflow-wrap:anywhere]">
                      {clipReportListPreview(globalDoctorNotes, 360)}
                    </p>
                  </div>
                ) : null}

                <div className="space-y-4">
                  {showFundus ? (
                    <section className="rounded-xl border border-indigo-200/80 bg-white p-4 shadow-sm">
                      <p className="text-sm font-bold text-indigo-950">
                        {t("patientDetailReports.modalityFundusSection")}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-4">
                        {r.originalImage ? (
                          <div className="min-w-0">
                            <p className="text-[10px] font-semibold uppercase text-slate-500">
                              {t("patientDetailReports.fundusImage")}
                            </p>
                            <ZoomableReportImage
                              src={r.originalImage}
                              alt=""
                              width={280}
                              height={200}
                              className="mt-1 inline-block"
                              imgClassName="max-h-52 w-auto max-w-full rounded-lg border border-slate-200 object-contain"
                              onOpen={() => setLightboxSrc(r.originalImage)}
                            />
                          </div>
                        ) : null}
                        {r.heatmapUrl ? (
                          <div className="w-full max-w-[200px] shrink-0">
                            <p className="text-[10px] font-semibold uppercase text-slate-500">
                              {t("patientDetailReports.heatmap")}
                            </p>
                            <ZoomableReportImage
                              src={r.heatmapUrl}
                              alt=""
                              width={200}
                              height={200}
                              className="mt-1 inline-block w-full"
                              imgClassName="aspect-square max-h-44 w-full rounded-lg border border-slate-200 object-contain"
                              onOpen={() => setLightboxSrc(r.heatmapUrl)}
                            />
                          </div>
                        ) : null}
                      </div>

                      <dl className="mt-4 space-y-3 text-sm">
                        <div>
                          <dt className="text-[11px] font-semibold text-slate-500">
                            {t("patientDetailReports.aiResultConfidenceRow")}
                          </dt>
                          <dd className="mt-1 text-slate-900">
                            {hasAiAnalysis ? (
                              <>
                                {aiRiskLabel}{" "}
                                <span className="text-slate-600">
                                  ({t("radiologicalReport.confidenceApproxShort")}{" "}
                                  {aiConfidenceLabel})
                                </span>
                                {fundusOdirLine ? (
                                  <span className="mt-1 block text-slate-700">
                                    {t("patientDetailReports.odirShort")}:{" "}
                                    {clipReportListPreview(fundusOdirLine, 200)}
                                  </span>
                                ) : null}
                              </>
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </dd>
                        </div>
                        <div>
                          <dt className="sr-only">
                            {t("patientDetailReports.aiNarrativeShort")}
                          </dt>
                          <dd className="mt-1">
                            <NarrativeCollapsible
                              title={t("patientDetailReports.aiNarrativeShort")}
                            >
                              <p className="whitespace-pre-wrap break-words leading-relaxed text-slate-800 [overflow-wrap:anywhere]">
                                {buildFundusAiNarrativeFull({
                                  inference,
                                  structuredAiSummary: structuredR?.aiSummary,
                                })}
                              </p>
                            </NarrativeCollapsible>
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[11px] font-semibold text-amber-900/90">
                            {t("patientDetailReports.doctorFeedbackEmphasis")}
                          </dt>
                          <dd className="mt-1 flex flex-wrap gap-1.5">
                            {fundusFeedbackLines.length > 0 ? (
                              fundusFeedbackLines.map((line, lineIdx) => (
                                <Badge
                                  key={`fb-${lineIdx}-${line}`}
                                  variant="secondary"
                                  className="border-amber-200/80 bg-amber-50 font-semibold text-slate-900"
                                >
                                  {formatDiagnosisLabel(line)}
                                </Badge>
                              ))
                            ) : (
                              <span className="font-normal text-slate-500">
                                —
                              </span>
                            )}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[11px] font-semibold text-slate-500">
                            {t("radiologicalReport.analysisNotesLabel")}
                          </dt>
                          <dd className="mt-1 text-slate-800">
                            {fundusAnalysisNotesFromSummary ? (
                              clipReportListPreview(
                                fundusAnalysisNotesFromSummary,
                                360,
                              )
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </dd>
                        </div>
                      </dl>
                    </section>
                  ) : null}

                  {showOct ? (
                    <section className="rounded-xl border border-cyan-200/80 bg-white p-4 shadow-sm">
                      <p className="text-sm font-bold text-cyan-950">
                        {t("patientDetailReports.modalityOctSection")}
                      </p>
                      {r.octImageUrl ? (
                        <div className="mt-3">
                          <p className="text-[10px] font-semibold uppercase text-slate-500">
                            {t("patientDetailReports.octImage")}
                          </p>
                          <ZoomableReportImage
                            src={r.octImageUrl}
                            alt=""
                            width={320}
                            height={220}
                            className="mt-1 inline-block max-w-full"
                            imgClassName="max-h-52 w-auto max-w-full rounded-lg border border-slate-200 object-contain"
                            onOpen={() => setLightboxSrc(r.octImageUrl)}
                          />
                        </div>
                      ) : null}

                      <dl className="mt-4 space-y-3 text-sm">
                        <div>
                          <dt className="text-[11px] font-semibold text-slate-500">
                            {t("patientDetailReports.aiResultConfidenceRow")}
                          </dt>
                          <dd className="mt-1 text-slate-900">
                            {octText
                              ? octResultSummaryLine(octText)
                              : "—"}
                          </dd>
                        </div>
                        <div>
                          <dt className="sr-only">
                            {t("patientDetailReports.aiNarrativeShort")}
                          </dt>
                          <dd className="mt-1">
                            <NarrativeCollapsible
                              title={t("patientDetailReports.aiNarrativeShort")}
                            >
                              <p className="whitespace-pre-wrap break-words leading-relaxed text-slate-800 [overflow-wrap:anywhere]">
                                {octText
                                  ? modalityAiTextFullMinusNotes(
                                      octText,
                                      analysisNotesHeading,
                                    )
                                  : "—"}
                              </p>
                            </NarrativeCollapsible>
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[11px] font-semibold text-amber-900/90">
                            {t("patientDetailReports.doctorFeedbackEmphasis")}
                          </dt>
                          <dd className="mt-1 font-semibold text-slate-900">
                            {octFb ? (
                              clipReportListPreview(octFb, 500)
                            ) : (
                              <span className="font-normal text-slate-500">
                                —
                              </span>
                            )}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[11px] font-semibold text-slate-500">
                            {t("radiologicalReport.analysisNotesLabel")}
                          </dt>
                          <dd className="mt-1 text-slate-800">
                            {octNotesExtracted ? (
                              clipReportListPreview(octNotesExtracted, 360)
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </dd>
                        </div>
                      </dl>
                    </section>
                  ) : null}

                  {showFfa ? (
                    <section className="rounded-xl border border-violet-200/80 bg-white p-4 shadow-sm">
                      <p className="text-sm font-bold text-violet-950">
                        {t("patientDetailReports.modalityFfaSection")}
                      </p>
                      {r.ffaImageUrl ? (
                        <div className="mt-3">
                          <p className="text-[10px] font-semibold uppercase text-slate-500">
                            {t("patientDetailReports.ffaImage")}
                          </p>
                          <ZoomableReportImage
                            src={r.ffaImageUrl}
                            alt=""
                            width={320}
                            height={220}
                            className="mt-1 inline-block max-w-full"
                            imgClassName="max-h-52 w-auto max-w-full rounded-lg border border-slate-200 object-contain"
                            onOpen={() => setLightboxSrc(r.ffaImageUrl)}
                          />
                        </div>
                      ) : null}

                      <dl className="mt-4 space-y-3 text-sm">
                        <div>
                          <dt className="text-[11px] font-semibold text-slate-500">
                            {t("patientDetailReports.aiResultConfidenceRow")}
                          </dt>
                          <dd className="mt-1 text-slate-900">
                            {ffaText
                              ? ffaConfidenceSnippet(ffaText)
                              : "—"}
                          </dd>
                        </div>
                        <div>
                          <dt className="sr-only">
                            {t("patientDetailReports.aiNarrativeShort")}
                          </dt>
                          <dd className="mt-1">
                            <NarrativeCollapsible
                              title={t("patientDetailReports.aiNarrativeShort")}
                            >
                              <p className="whitespace-pre-wrap break-words leading-relaxed text-slate-800 [overflow-wrap:anywhere]">
                                {ffaText
                                  ? modalityAiTextFullMinusNotes(
                                      ffaText,
                                      analysisNotesHeading,
                                    )
                                  : "—"}
                              </p>
                            </NarrativeCollapsible>
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[11px] font-semibold text-amber-900/90">
                            {t("patientDetailReports.doctorFeedbackEmphasis")}
                          </dt>
                          <dd className="mt-1 font-semibold text-slate-900">
                            {ffaFbDisplay ? (
                              clipReportListPreview(ffaFbDisplay, 500)
                            ) : (
                              <span className="font-normal text-slate-500">
                                —
                              </span>
                            )}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[11px] font-semibold text-slate-500">
                            {t("radiologicalReport.analysisNotesLabel")}
                          </dt>
                          <dd className="mt-1 text-slate-800">
                            {ffaNotesExtracted ? (
                              clipReportListPreview(ffaNotesExtracted, 360)
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </dd>
                        </div>
                      </dl>
                    </section>
                  ) : null}

                  {!showFundus && !showOct && !showFfa ? (
                    <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                      {t("patientDetailReports.radiologyEmptyModalities")}
                    </p>
                  ) : null}
                </div>

                <p className="mt-4 text-[11px] text-slate-500">
                  {t("patientDetailReports.listPreviewNote")}
                </p>
              </div>
            );
          })}
      </CardContent>
    </Card>
      {lightboxSrc ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("patientDetailReports.imageLightboxTitle")}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 p-4"
          onClick={() => setLightboxSrc(null)}
        >
          <button
            type="button"
            aria-label={t("patientDetailReports.imageLightboxClose")}
            className="absolute right-4 top-4 rounded-full bg-white/15 p-2 text-white transition hover:bg-white/25"
            onClick={(e) => {
              e.stopPropagation();
              setLightboxSrc(null);
            }}
          >
            <X className="h-5 w-5" />
          </button>
          <div
            className="flex max-h-full max-w-full items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxSrc}
              alt=""
              className="max-h-[92vh] max-w-[96vw] object-contain"
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
