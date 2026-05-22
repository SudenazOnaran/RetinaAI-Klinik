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
import { Loader2, Upload, X, Activity } from "lucide-react";
import { useTranslation } from "@/components/providers/i18n-provider";
import { logStructuredError } from "@/lib/structured-error-log";
import { buildOctTextForReport } from "@/lib/ai-modality-report-text";
import { ANALYSIS_NOTES_MAX_LEN } from "@/lib/dataset/analysis-report-sections";
import { fileToDataUrl } from "@/lib/file-to-data-url";
import { cn } from "@/lib/utils";
import {
  ModalityConditionFeedback,
  type ModalityAiPickItem,
} from "@/components/dashboard/modality-condition-feedback";
import {
  mergeOctStaticWithAiConditions,
  OCT_DISAGREE_MATCH,
  OCT_HEALTHY_VALUE,
} from "@/lib/modality-risk-surface";
import {
  RadiologicalAiSummaryOneLine,
  RadiologicalAnalysisTimestamp,
  RadiologicalClinicalDetailCollapsible,
  RadiologicalHeatmapPreview,
  RadiologicalMedicalDisclaimer,
  RadiologicalReadyBanner,
  type ModalityAttentionRegion,
  octLikelihoodToApproxConfidencePct,
  pickHighestLikelihoodNamedRow,
} from "@/components/dashboard/radiological-modality-blocks";
import { parseModalityHeatmapFromApiResponse } from "@/lib/modality-heatmap";
import {
  fileWithAiUploadName,
  formatUnsupportedImageMessage,
  humanizeAiImageUploadError,
  isFormatRelatedAiError,
  validateAiImageFile,
} from "@/lib/ai-upload-filename";

export type OctCondition = {
  name: string;
  likelihood: string;
  supportingFindings: string[];
  contradictingFindings: string[];
};

export type OctPayload = {
  imageQuality: string;
  findings: string[];
  conditions: OctCondition[];
  clinicalSummary: string;
  recommendations: string[];
  confidenceScore?: number;
};

const LIKELIHOOD_KEYS = ["low", "moderate", "high"] as const;

function displayLikelihood(
  norm: string,
  t: (k: string) => string,
): string {
  const x = (norm || "low").toLowerCase();
  if (x === "moderate") return t("octAnalysis.likelihoodModerate");
  if (x === "high") return t("octAnalysis.likelihoodHigh");
  return t("octAnalysis.likelihoodLow");
}

type MacularOctAnalysisCardProps = {
  patientId: string;
  /** panel: sağ sütun modüler kart; full: eski tam kart görünümü */
  variant?: "full" | "panel";
  /** Muayene bulgularına metin ekler (panel modunda) */
  onAppendToReport?: (text: string) => void;
  /** Rapora kaydedilecek OCT kaynak görüntüsü (data URL); temizlenince null */
  onReportImageChange?: (dataUrl: string | null) => void;
  /** Manuel rapor kaydında Analysis.octDrFeedback ile saklanır */
  reportDoctorFeedback?: string;
  onReportDoctorFeedbackChange?: (value: string) => void;
  /** true: pano başlığını dış sarmalayıcı (ai-analysis-panel) sağlar */
  suppressHeader?: boolean;
  className?: string;
};

export function MacularOctAnalysisCard({
  patientId,
  variant = "full",
  onAppendToReport,
  onReportImageChange,
  reportDoctorFeedback,
  onReportDoctorFeedbackChange,
  suppressHeader = false,
  className,
}: MacularOctAnalysisCardProps) {
  const isPanel = variant === "panel";
  const { t, locale } = useTranslation();
  const { toast } = useToast();
  const inputId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<OctPayload | null>(null);
  const [heatmapPlus, setHeatmapPlus] = useState<string | null>(null);
  const [attentionRegions, setAttentionRegions] = useState<ModalityAttentionRegion[]>(
    [],
  );
  const [analysisNotes, setAnalysisNotes] = useState("");
  const [analysisCompletedAt, setAnalysisCompletedAt] = useState<Date | null>(
    null,
  );
  const [didAppendToReport, setDidAppendToReport] = useState(false);

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
    setHeatmapPlus(null);
    setAttentionRegions([]);
    setAnalysisNotes("");
    setAnalysisCompletedAt(null);
    setDidAppendToReport(false);
    onReportDoctorFeedbackChange?.("");
    void fileToDataUrl(f)
      .then((dataUrl) => onReportImageChange?.(dataUrl))
      .catch(() => onReportImageChange?.(null));
  };

  const clearAll = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setResult(null);
    setHeatmapPlus(null);
    setAttentionRegions([]);
    setAnalysisNotes("");
    setAnalysisCompletedAt(null);
    setDidAppendToReport(false);
    onReportImageChange?.(null);
    onReportDoctorFeedbackChange?.("");
  };

  const handleAppend = () => {
    if (!result) return;
    if (!onAppendToReport) return;
    const text = buildOctTextForReport(
      result,
      analysisNotes,
      t as (k: string, o?: Record<string, string | number>) => string,
    );
    onAppendToReport(text);
    setDidAppendToReport(true);
    toast({
      title: t("aiAnalysisPanel.appendSuccessTitle"),
      description: t("aiAnalysisPanel.appendSuccessDesc"),
      duration: 3000,
    });
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setIsLoading(true);
    const clientRid = crypto.randomUUID();
    try {
      const fd = new FormData();
      fd.append("image", fileWithAiUploadName(file, "oct"));
      fd.append("patientId", patientId);
      fd.append("locale", locale === "tr" ? "tr" : "en");

      const res = await fetch("/api/ai/predict-oct", {
        method: "POST",
        headers: { "x-request-id": clientRid },
        body: fd,
      });
      const data = (await res.json()) as Record<string, unknown>;
      if (res.ok && data.success) {
        const oct = data.oct as OctPayload | undefined;
        if (oct && typeof oct === "object") {
          setResult(oct);
          const hm = parseModalityHeatmapFromApiResponse(
            data,
            oct as unknown as Record<string, unknown>,
          );
          setHeatmapPlus(hm.heatmapPlus);
          setAttentionRegions(hm.attentionRegions);
          setAnalysisCompletedAt(new Date());
          setDidAppendToReport(false);
        } else {
          toast({
            variant: "destructive",
            title: t("errorPage.title"),
            description: t("octAnalysis.parseFail"),
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
        route: `${typeof window !== "undefined" ? window.location.pathname : ""}(oct-client)`,
        action: "AI_OCT_CLIENT",
        patientId,
        errorMessage: err.message,
        stack: err.stack,
        payloadSummary: JSON.stringify({ fileName: file?.name, fileSize: file?.size }),
      });
      toast({
        variant: "destructive",
        title: t("errorPage.title"),
        description: t("octAnalysis.analysisFail"),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const showReportActions = Boolean(onAppendToReport && isPanel);
  const fileInputId = `oct-file-${inputId}`;

  const octDisagreeItems = useMemo((): ModalityAiPickItem[] => {
    const merged = mergeOctStaticWithAiConditions(
      OCT_DISAGREE_MATCH,
      result?.conditions,
    );
    const items: ModalityAiPickItem[] = merged.map((m) => ({
      value: m.value,
      label: t(`modalityDisagree.oct.${m.valueKey}` as never),
    }));
    items.push({
      value: OCT_HEALTHY_VALUE,
      label: t("modalityDisagree.oct.oct_saglikli_makula"),
    });
    return items;
  }, [result, t]);

  const octPrimaryElevated = useMemo(
    () => (result ? pickHighestLikelihoodNamedRow(result.conditions) : null),
    [result],
  );

  const octBannerLabel = useMemo(() => {
    if (!result) return "";
    if (Number(result.confidenceScore ?? 0) < 75) {
      return t("radiologicalReport.confidenceUndeterminedShort");
    }
    const healthyLbl = t("modalityDisagree.oct.oct_saglikli_makula");
    if (octPrimaryElevated?.name?.trim()) return octPrimaryElevated.name.trim();
    if (result.conditions?.length) return healthyLbl;
    return "—";
  }, [result, octPrimaryElevated, t]);

  const octApprovalAiSummaryLabel = useMemo(() => {
    if (!result) return "";
    if (Number(result.confidenceScore ?? 0) < 75) {
      return t("radiologicalReport.confidenceUndeterminedShort");
    }
    const healthyLbl = t("modalityDisagree.oct.oct_saglikli_makula");
    if (octPrimaryElevated?.name?.trim()) return octPrimaryElevated.name.trim();
    if (result.conditions?.length) return healthyLbl;
    const cs = result.clinicalSummary?.trim();
    return cs ? cs.slice(0, 280) : healthyLbl;
  }, [result, octPrimaryElevated, t]);

  return (
    <Card
      className={cn(
        isPanel
          ? "border border-slate-200 bg-white shadow-sm"
          : "border border-[#d8e0df] bg-white shadow-sm",
        className,
      )}
    >
      {isPanel && !suppressHeader ? (
        <div className="border-b border-slate-100 bg-[#f8f9fc] px-3 py-2">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-700">
            {t("aiAnalysisPanel.octShort")}
          </p>
          <p className="text-[11px] text-slate-500">{t("octAnalysis.title")}</p>
        </div>
      ) : !isPanel ? (
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="flex items-center gap-2 text-slate-900">
            <Activity className="h-5 w-5 text-[var(--retina-primary)]" />
            {t("octAnalysis.title")}
          </CardTitle>
          <CardDescription>{t("octAnalysis.description")}</CardDescription>
        </CardHeader>
      ) : null}
      <CardContent className="space-y-3 pt-3">
        {!isPanel ? (
          <p
            className={
              "rounded-lg border border-amber-100 bg-amber-50/80 px-3 py-2 text-xs text-amber-950"
            }
          >
            {t("octAnalysis.disclaimer")}
          </p>
        ) : null}

        {!previewUrl ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 space-y-1">
              <label
                className="flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 text-xs text-slate-700"
                htmlFor={fileInputId}
              >
                <Upload className="h-3.5 w-3.5" />
                {t("octAnalysis.selectImage")}
              </label>
              <input
                id={fileInputId}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/bmp,image/tiff,.tif,.tiff"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          </div>
        ) : (
          <>
            {file ? (
              <p className="truncate text-[11px] text-slate-600">{file.name}</p>
            ) : null}
            <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-950">
              <div
                className={
                  result
                    ? "relative h-[min(44vh,480px)] min-h-[260px] w-full sm:min-h-[300px]"
                    : "relative h-[min(56vh,560px)] min-h-[320px] w-full sm:min-h-[380px]"
                }
              >
                <Image
                  src={previewUrl}
                  alt="OCT preview"
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
                aria-label={t("octAnalysis.clearImage")}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}

        <Button
          className="h-9 w-full rounded-lg bg-[var(--retina-primary)] text-sm text-white"
          type="button"
          disabled={!file || isLoading}
          onClick={handleAnalyze}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t("octAnalysis.analyzing")}
            </>
          ) : (
            t("octAnalysis.analyze")
          )}
        </Button>

        {result ? (
          <div className="space-y-3 border-t border-slate-200 pt-3 text-sm text-slate-800">
            <RadiologicalMedicalDisclaimer
              className={isPanel ? "text-[11px]" : "text-xs"}
            />
            {analysisCompletedAt ? (
              <RadiologicalAnalysisTimestamp at={analysisCompletedAt} />
            ) : null}

            {(() => {
              const pct = octPrimaryElevated
                ? octLikelihoodToApproxConfidencePct(
                    octPrimaryElevated.likelihood,
                  )
                : 38;
              return (
                <RadiologicalAiSummaryOneLine
                  diseaseLabel={octBannerLabel || "—"}
                  confidencePct={pct}
                />
              );
            })()}

            {heatmapPlus ? (
              <RadiologicalHeatmapPreview
                heatmapDataUri={heatmapPlus}
                title={t("octAnalysis.heatmapTitle")}
                alt={t("octAnalysis.heatmapAlt")}
                hint={t("octAnalysis.heatmapHint")}
                regions={attentionRegions}
              />
            ) : null}

            <RadiologicalClinicalDetailCollapsible
              title={t("radiologicalReport.clinicalDetailTitle")}
              defaultOpen
            >
              <div className="max-h-[min(56vh,440px)] space-y-3 overflow-y-auto text-sm text-slate-800">
                {result.clinicalSummary ? (
                  <div>
                    <p className="text-[10px] font-semibold uppercase text-slate-500">
                      {t("aiAnalysisPanel.octAiSummaryTitle")}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed [overflow-wrap:anywhere]">
                      {result.clinicalSummary}
                    </p>
                  </div>
                ) : null}

                <div>
                  <p className="text-[10px] font-semibold uppercase text-slate-500">
                    {t("octAnalysis.imageQuality")}
                  </p>
                  <p className="mt-0.5 text-xs">{result.imageQuality}</p>
                </div>

                <div>
                  <p className="text-[10px] font-semibold uppercase text-slate-500">
                    {t("octAnalysis.findings")}
                  </p>
                  <ul className="mt-0.5 list-inside list-disc space-y-0.5 text-xs">
                    {result.findings.length > 0
                      ? result.findings.map((f, i) => (
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
                    {t("octAnalysis.conditions")}
                  </p>
                  <div className="mt-1 space-y-2">
                    {result.conditions.length > 0 ? (
                      result.conditions.map((c, i) => {
                        const norm = LIKELIHOOD_KEYS.includes(
                          c.likelihood as (typeof LIKELIHOOD_KEYS)[number],
                        )
                          ? c.likelihood
                          : "low";
                        return (
                          <div
                            key={i}
                            className="rounded border border-slate-200 bg-slate-50/80 p-2"
                          >
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-xs font-medium text-slate-900">
                                {c.name}
                              </span>
                              <Badge variant="secondary" className="text-[10px]">
                                {displayLikelihood(norm, t)}
                              </Badge>
                            </div>
                            {c.supportingFindings.length > 0 ? (
                              <p className="mt-1 text-[11px] text-slate-600">
                                <span className="font-semibold text-slate-700">
                                  {t("octAnalysis.supporting")}{" "}
                                </span>
                                {c.supportingFindings.join(" · ")}
                              </p>
                            ) : null}
                            {c.contradictingFindings.length > 0 ? (
                              <p className="mt-1 text-[11px] text-slate-600">
                                <span className="font-semibold text-slate-700">
                                  {t("octAnalysis.contradicting")}{" "}
                                </span>
                                {c.contradictingFindings.join(" · ")}
                              </p>
                            ) : null}
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-slate-500">—</p>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-semibold uppercase text-slate-500">
                    {t("octAnalysis.recommendations")}
                  </p>
                  <ul className="mt-0.5 list-inside list-decimal space-y-0.5 text-xs">
                    {result.recommendations.length > 0
                      ? result.recommendations.map((r, i) => (
                          <li key={i} className="[overflow-wrap:anywhere]">
                            {r}
                          </li>
                        ))
                      : (
                        <li className="text-slate-500">—</li>
                      )}
                  </ul>
                </div>
              </div>
            </RadiologicalClinicalDetailCollapsible>

            <RadiologicalReadyBanner addedToReport={didAppendToReport} />
          </div>
        ) : null}
      </CardContent>
      {result &&
        isPanel &&
        (onReportDoctorFeedbackChange ||
          showReportActions ||
          onAppendToReport) && (
        <div className="border-t border-slate-200/90 bg-slate-50/90 px-3 pb-4 pt-4 md:rounded-b-xl md:px-4 md:pb-5">
          {onReportDoctorFeedbackChange ? (
            <div className="space-y-2">
              <ModalityConditionFeedback
                value={reportDoctorFeedback ?? ""}
                onChange={onReportDoctorFeedbackChange}
                items={octDisagreeItems}
                disagreePrompt={t("aiAnalysisPanel.modalityPickOctDisagreeStatic")}
                noItemsHint={t("aiAnalysisPanel.modalityNoAiListForPickOct")}
                allowDisagreeWhenEmpty
                approvalAiSummaryLabel={octApprovalAiSummaryLabel}
              />
            </div>
          ) : null}

          {(onReportDoctorFeedbackChange || showReportActions) ? (
            <div
              className={
                onReportDoctorFeedbackChange
                  ? "mt-3 space-y-2 border-t border-slate-200/90 pt-3"
                  : "space-y-2"
              }
            >
              <label className="block text-[11px] font-medium text-slate-700">
                <span>{t("radiologicalReport.analysisNotesLabel")}</span>
                <span className="ml-1 font-normal text-slate-500">
                  ({t("radiologicalReport.optionalTag")})
                </span>
                <Textarea
                  value={analysisNotes}
                  onChange={(e) => setAnalysisNotes(e.target.value)}
                  className="mt-1 min-h-[72px] text-xs"
                  placeholder={t("radiologicalReport.analysisNotesPlaceholder")}
                  maxLength={ANALYSIS_NOTES_MAX_LEN}
                />
                <span className="mt-0.5 block text-[10px] text-slate-500">
                  {analysisNotes.length}/{ANALYSIS_NOTES_MAX_LEN}
                </span>
              </label>
            </div>
          ) : null}

          {showReportActions ? (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                className="h-9 flex-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={handleAppend}
              >
                {t("radiologicalReport.appendToReport")}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-9 flex-1"
                onClick={clearAll}
              >
                {t("radiologicalReport.clearModality")}
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </Card>
  );
}
