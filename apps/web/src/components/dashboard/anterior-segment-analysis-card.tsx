"use client";

import { useId, useMemo, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Eye, Loader2, Upload, X } from "lucide-react";
import { useTranslation } from "@/components/providers/i18n-provider";
import { logStructuredError } from "@/lib/structured-error-log";
import { ANALYSIS_NOTES_MAX_LEN } from "@/lib/dataset/analysis-report-sections";
import { cn } from "@/lib/utils";
import {
  ModalityConditionFeedback,
  type ModalityAiPickItem,
} from "@/components/dashboard/modality-condition-feedback";
import {
  ANTERIOR_SEGMENT_DISEASE_KEYS,
  ANTERIOR_SEGMENT_HEALTHY_VALUE,
  anteriorSegmentSurfaceRiskFromPayload,
  mergeAnteriorSegmentStaticWithAiDiseases,
  pickHighestAnteriorSegmentDisease,
} from "@/lib/modality-risk-surface";
import {
  RadiologicalAiSummaryOneLine,
  RadiologicalAnalysisTimestamp,
  RadiologicalClinicalDetailCollapsible,
  RadiologicalMedicalDisclaimer,
  normalizePercentScore,
} from "@/components/dashboard/radiological-modality-blocks";
import {
  fileWithAiUploadName,
  formatUnsupportedImageMessage,
  humanizeAiImageUploadError,
  isFormatRelatedAiError,
  validateAiImageFile,
} from "@/lib/ai-upload-filename";

export type AnteriorSegmentDiseaseAssessment = {
  disease: string;
  status: string;
  confidence: number;
  supportingFindings: string[];
  evaluatedStructures: string[];
};

export type AnteriorSegmentPayload = {
  imageQuality: {
    qualityScore: number;
    issues: string[];
  };
  detectedFindings: string[];
  diseaseAssessment: AnteriorSegmentDiseaseAssessment[];
  urgentReferralNeeded: boolean;
  urgentReasons: string[];
  overallSummary: string;
};

function displayStatus(
  status: string,
  t: (k: string) => string,
): string {
  const s = String(status || "")
    .trim()
    .toLowerCase();
  if (s === "present") return t("anteriorSegmentAnalysis.statusPresent");
  if (s === "possibly_present") return t("anteriorSegmentAnalysis.statusPossiblyPresent");
  if (s === "limited_assessment") return t("anteriorSegmentAnalysis.statusLimitedAssessment");
  return t("anteriorSegmentAnalysis.statusNotDetected");
}

function statusBadgeVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  const s = String(status || "")
    .trim()
    .toLowerCase();
  if (s === "present") return "destructive";
  if (s === "possibly_present") return "default";
  if (s === "limited_assessment") return "secondary";
  return "outline";
}

type AnteriorSegmentAnalysisCardProps = {
  patientId?: string;
  variant?: "full" | "panel";
  suppressHeader?: boolean;
  reportDoctorFeedback?: string;
  onReportDoctorFeedbackChange?: (value: string) => void;
  className?: string;
};

export function AnteriorSegmentAnalysisCard({
  patientId,
  variant = "full",
  suppressHeader = false,
  reportDoctorFeedback,
  onReportDoctorFeedbackChange,
  className,
}: AnteriorSegmentAnalysisCardProps) {
  const isPanel = variant === "panel";
  const { t, locale } = useTranslation();
  const { toast } = useToast();
  const inputId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AnteriorSegmentPayload | null>(null);
  const [analysisNotes, setAnalysisNotes] = useState("");
  const [analysisCompletedAt, setAnalysisCompletedAt] = useState<Date | null>(
    null,
  );
  const [localDoctorFeedback, setLocalDoctorFeedback] = useState("");

  const doctorFeedback = reportDoctorFeedback ?? localDoctorFeedback;
  const setDoctorFeedback =
    onReportDoctorFeedbackChange ?? setLocalDoctorFeedback;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const check = validateAiImageFile(f);
    if (!check.ok) {
      e.target.value = "";
      toast({
        variant: "destructive",
        title: t("analysisCard.unsupportedFormatTitle"),
        description: formatUnsupportedImageMessage(t, check.displayExt),
      });
      return;
    }
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setResult(null);
    setAnalysisNotes("");
    setAnalysisCompletedAt(null);
    setDoctorFeedback("");
  };

  const clearAll = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setResult(null);
    setAnalysisNotes("");
    setAnalysisCompletedAt(null);
    setDoctorFeedback("");
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setIsLoading(true);
    const clientRid = crypto.randomUUID();
    try {
      const fd = new FormData();
      fd.append("image", fileWithAiUploadName(file, "anterior-segment"));
      if (patientId) fd.append("patientId", patientId);
      fd.append("locale", locale === "tr" ? "tr" : "en");

      const res = await fetch("/api/ai/predict-anterior-segment", {
        method: "POST",
        headers: { "x-request-id": clientRid },
        body: fd,
      });
      const data = (await res.json()) as Record<string, unknown>;
      if (res.ok && data.success) {
        const payload = data.anteriorSegment as AnteriorSegmentPayload | undefined;
        if (payload && typeof payload === "object") {
          setResult(payload);
          setAnalysisCompletedAt(new Date());
        } else {
          toast({
            variant: "destructive",
            title: t("errorPage.title"),
            description: t("anteriorSegmentAnalysis.parseFail"),
          });
        }
      } else if (data.queued) {
        toast({
          title: t("analysisCard.queueTitle"),
          description: t("analysisCard.queueDesc"),
        });
      } else {
        const rawErr =
          typeof data.error === "string" ? data.error.trim() : "";
        const serverErr = rawErr
          ? humanizeAiImageUploadError(rawErr, t)
          : t("analysisCard.serviceUnavailableRetry");
        toast({
          variant: "destructive",
          title: isFormatRelatedAiError(rawErr)
            ? t("analysisCard.unsupportedFormatTitle")
            : t("errorPage.title"),
          description: serverErr,
        });
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logStructuredError({
        requestId: clientRid,
        route: `${typeof window !== "undefined" ? window.location.pathname : ""}(anterior-segment-client)`,
        action: "AI_ANTERIOR_SEGMENT_CLIENT",
        patientId,
        errorMessage: err.message,
        stack: err.stack,
        payloadSummary: JSON.stringify({ fileName: file?.name, fileSize: file?.size }),
      });
      toast({
        variant: "destructive",
        title: t("errorPage.title"),
        description: t("anteriorSegmentAnalysis.analysisFail"),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const primaryElevated = useMemo(
    () => (result ? pickHighestAnteriorSegmentDisease(result.diseaseAssessment) : null),
    [result],
  );

  const bannerLabel = useMemo(() => {
    if (!result) return "";
    if (primaryElevated?.disease?.trim()) return primaryElevated.disease.trim();
    if (anteriorSegmentSurfaceRiskFromPayload(result)) return "—";
    return t(`modalityDisagree.anteriorSegment.${ANTERIOR_SEGMENT_HEALTHY_VALUE}`);
  }, [result, primaryElevated, t]);

  const approvalAiSummaryLabel = useMemo(() => {
    if (!result) return "";
    if (primaryElevated?.disease?.trim()) return primaryElevated.disease.trim();
    const summary = result.overallSummary?.trim();
    if (summary) return summary.slice(0, 280);
    return t(`modalityDisagree.anteriorSegment.${ANTERIOR_SEGMENT_HEALTHY_VALUE}`);
  }, [result, primaryElevated, t]);

  const disagreeItems: ModalityAiPickItem[] = useMemo(() => {
    const merged = mergeAnteriorSegmentStaticWithAiDiseases(
      ANTERIOR_SEGMENT_DISEASE_KEYS,
      result?.diseaseAssessment,
    );
    return merged.map((row) => ({
      value: row.valueKey,
      label: t(`modalityDisagree.anteriorSegment.${row.valueKey}`),
    }));
  }, [result, t]);

  const summaryConfidencePct = useMemo(() => {
    if (primaryElevated) {
      return normalizePercentScore(primaryElevated.confidence);
    }
    if (result?.imageQuality?.qualityScore) {
      return normalizePercentScore(result.imageQuality.qualityScore);
    }
    return 38;
  }, [primaryElevated, result]);

  return (
    <Card
      className={cn(
        isPanel
          ? "border border-slate-200 bg-white shadow-sm"
          : "w-full min-w-0 overflow-hidden border border-slate-200 bg-gradient-to-b from-slate-50 to-white rounded-3xl shadow-xl",
        className,
      )}
    >
      {isPanel && !suppressHeader ? (
        <div className="border-b border-slate-100 bg-[#f8f9fc] px-3 py-2">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-700">
            {t("aiAnalysisPanel.anteriorSegmentShort")}
          </p>
          <p className="text-[11px] text-slate-500">
            {t("anteriorSegmentAnalysis.title")}
          </p>
        </div>
      ) : !isPanel && !suppressHeader ? (
        <CardHeader className="space-y-2 border-b border-slate-200 bg-white/90 pb-5">
          <CardTitle className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">
            <Eye className="h-6 w-6 text-[var(--retina-primary)]" />
            {t("anteriorSegmentAnalysis.title")}
          </CardTitle>
          <CardDescription className="max-w-3xl text-sm text-slate-600 md:text-base">
            {t("anteriorSegmentAnalysis.description")}
          </CardDescription>
        </CardHeader>
      ) : null}

      <CardContent className={cn("space-y-4", isPanel ? "pt-3" : "p-4 md:p-6")}>
        {!isPanel ? (
          <p className="rounded-lg border border-amber-100 bg-amber-50/80 px-3 py-2 text-xs leading-relaxed text-amber-950">
            {t("anteriorSegmentAnalysis.disclaimer")}
          </p>
        ) : null}

        {!previewUrl ? (
          isPanel ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1 space-y-1">
                <label
                  className="flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 text-xs text-slate-700"
                  htmlFor={inputId}
                >
                  <Upload className="h-3.5 w-3.5" />
                  {t("anteriorSegmentAnalysis.selectImage")}
                </label>
                <input
                  id={inputId}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/bmp,image/tiff,.tif,.tiff"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            </div>
          ) : (
            <div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-cyan-300 bg-cyan-50/40 p-10 text-center transition-colors hover:border-cyan-400 hover:bg-cyan-50 md:p-14">
              <Upload className="mx-auto mb-4 h-12 w-12 text-cyan-700" />
              <p className="text-base font-semibold text-slate-800 md:text-lg">
                {t("anteriorSegmentAnalysis.selectImage")}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {t("analysisCard.supportedFormats")}
              </p>
              <input
                id={inputId}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/bmp,image/tiff,.tif,.tiff"
                className="absolute inset-0 cursor-pointer opacity-0"
                onChange={handleFileChange}
              />
            </div>
          )
        ) : (
          <>
            {file ? (
              <p className="truncate text-[11px] text-slate-600">{file.name}</p>
            ) : null}
            <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-950">
              <div
                className={cn(
                  "relative w-full",
                  result
                    ? "h-[min(44vh,480px)] min-h-[260px] sm:min-h-[300px]"
                    : "h-[min(56vh,560px)] min-h-[320px] sm:min-h-[380px]",
                )}
              >
                <Image
                  src={previewUrl}
                  alt={t("anteriorSegmentAnalysis.previewAlt")}
                  fill
                  unoptimized
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-contain"
                />
              </div>
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute right-3 top-3 h-9 w-9 rounded-xl"
                onClick={clearAll}
                aria-label={t("anteriorSegmentAnalysis.clearImage")}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}

        {!result && (
          <Button
            className={cn(
              "w-full rounded-xl bg-[var(--retina-primary)] text-white",
              isPanel ? "h-9 text-sm" : "h-13 text-base font-semibold",
            )}
            type="button"
            disabled={!file || isLoading}
            onClick={handleAnalyze}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("anteriorSegmentAnalysis.analyzing")}
              </>
            ) : (
              t("anteriorSegmentAnalysis.analyze")
            )}
          </Button>
        )}

        {result ? (
          <div className="space-y-4 border-t border-slate-200 pt-4">
            <RadiologicalMedicalDisclaimer
              className={isPanel ? "text-[11px]" : "text-xs"}
            />
            {analysisCompletedAt ? (
              <RadiologicalAnalysisTimestamp at={analysisCompletedAt} />
            ) : null}

            {result.urgentReferralNeeded ? (
              <div className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-950">
                <p className="font-semibold">
                  {t("anteriorSegmentAnalysis.urgentReferralTitle")}
                </p>
                {result.urgentReasons.length > 0 ? (
                  <ul className="mt-2 list-inside list-disc text-xs">
                    {result.urgentReasons.map((reason, i) => (
                      <li key={i}>{reason}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            <RadiologicalAiSummaryOneLine
              diseaseLabel={bannerLabel || "—"}
              confidencePct={summaryConfidencePct}
            />

            <RadiologicalClinicalDetailCollapsible
              title={t("radiologicalReport.clinicalDetailTitle")}
              defaultOpen
            >
              <div className="max-h-[min(56vh,480px)] space-y-4 overflow-y-auto text-sm text-slate-800">
                {result.overallSummary ? (
                  <div>
                    <p className="text-[10px] font-semibold uppercase text-slate-500">
                      {t("anteriorSegmentAnalysis.overallSummary")}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed [overflow-wrap:anywhere]">
                      {result.overallSummary}
                    </p>
                  </div>
                ) : null}

                <div>
                  <p className="text-[10px] font-semibold uppercase text-slate-500">
                    {t("anteriorSegmentAnalysis.imageQuality")}
                  </p>
                  <p className="mt-0.5 text-xs">
                    {t("anteriorSegmentAnalysis.qualityScore")}:{" "}
                    {result.imageQuality.qualityScore || "—"}
                  </p>
                  {result.imageQuality.issues.length > 0 ? (
                    <ul className="mt-1 list-inside list-disc text-xs text-slate-600">
                      {result.imageQuality.issues.map((issue, i) => (
                        <li key={i}>{issue}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>

                <div>
                  <p className="text-[10px] font-semibold uppercase text-slate-500">
                    {t("anteriorSegmentAnalysis.detectedFindings")}
                  </p>
                  <ul className="mt-0.5 list-inside list-disc space-y-0.5 text-xs">
                    {result.detectedFindings.length > 0
                      ? result.detectedFindings.map((f, i) => (
                          <li key={i} className="[overflow-wrap:anywhere]">
                            {f}
                          </li>
                        ))
                      : (
                        <li className="text-slate-500">—</li>
                      )}
                  </ul>
                </div>

                <div>
                  <p className="text-[10px] font-semibold uppercase text-slate-500">
                    {t("anteriorSegmentAnalysis.diseaseAssessment")}
                  </p>
                  <div className="mt-1 space-y-2">
                    {result.diseaseAssessment.length > 0 ? (
                      result.diseaseAssessment.map((row, i) => (
                        <div
                          key={`${row.disease}-${i}`}
                          className="rounded border border-slate-200 bg-slate-50/80 p-2"
                        >
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-xs font-medium text-slate-900">
                              {row.disease}
                            </span>
                            <Badge
                              variant={statusBadgeVariant(row.status)}
                              className="text-[10px]"
                            >
                              {displayStatus(row.status, t)}
                            </Badge>
                            <span className="text-[10px] text-slate-500">
                              %{Number(row.confidence || 0).toFixed(0)}
                            </span>
                          </div>
                          {row.supportingFindings.length > 0 ? (
                            <p className="mt-1 text-[11px] text-slate-600">
                              <span className="font-semibold text-slate-700">
                                {t("anteriorSegmentAnalysis.supporting")}{" "}
                              </span>
                              {row.supportingFindings.join(" · ")}
                            </p>
                          ) : null}
                          {row.evaluatedStructures.length > 0 ? (
                            <p className="mt-1 text-[11px] text-slate-500">
                              <span className="font-semibold text-slate-600">
                                {t("anteriorSegmentAnalysis.evaluatedStructures")}{" "}
                              </span>
                              {row.evaluatedStructures.join(", ")}
                            </p>
                          ) : null}
                        </div>
                      ))
                    ) : (
                      <p className="text-slate-500">—</p>
                    )}
                  </div>
                </div>
              </div>
            </RadiologicalClinicalDetailCollapsible>
          </div>
        ) : null}
      </CardContent>

      {result ? (
        <div
          className={cn(
            "border-t border-slate-200 bg-slate-50/70",
            isPanel ? "px-3 pb-4 pt-4 md:px-4 md:pb-5" : "px-4 pb-6 pt-5 md:px-6 md:pb-8",
          )}
        >
          <div className="space-y-4">
            <ModalityConditionFeedback
              value={doctorFeedback}
              onChange={setDoctorFeedback}
              items={disagreeItems}
              disagreePrompt={t("aiAnalysisPanel.modalityPickAnteriorSegmentDisagree")}
              noItemsHint={t("aiAnalysisPanel.modalityNoAiListForPickAnteriorSegment")}
              allowDisagreeWhenEmpty
              approvalAiSummaryLabel={approvalAiSummaryLabel}
            />

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <label className="block text-sm font-medium text-slate-800">
                <span>{t("radiologicalReport.analysisNotesLabel")}</span>
                <span className="font-normal text-slate-500">
                  {" "}
                  ({t("radiologicalReport.optionalTag")})
                </span>
                <Textarea
                  value={analysisNotes}
                  onChange={(e) => setAnalysisNotes(e.target.value)}
                  className="mt-2 min-h-[80px] text-sm"
                  placeholder={t("radiologicalReport.analysisNotesPlaceholder")}
                  maxLength={ANALYSIS_NOTES_MAX_LEN}
                />
                <span className="mt-1 block text-[11px] text-slate-500">
                  {analysisNotes.length}/{ANALYSIS_NOTES_MAX_LEN}
                </span>
              </label>
            </div>

            {isPanel ? (
              <Button
                type="button"
                className="h-9 w-full rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-100"
                onClick={clearAll}
              >
                {t("radiologicalReport.clearModality")}
              </Button>
            ) : (
              <Button
                type="button"
                className="h-11 w-full rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-100"
                onClick={clearAll}
              >
                {t("analysisCard.clear")}
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </Card>
  );
}
