"use client";

import { useId, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  Upload,
  X,
  Loader2,
  Zap,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { drLabelTr } from "@/lib/dr-label-tr";
import {
  DR_STAGE_LABELS_EN,
  DR_STAGE_LABELS_TR,
  getStorageDrLabel,
  resolveDrLabelToStoredForm,
} from "@/lib/dr-stage-labels";
import { useTranslation } from "@/components/providers/i18n-provider";
import { logStructuredError } from "@/lib/structured-error-log";
import type { Locale } from "@/lib/i18n/config";
import {
  stripPredictResponseForStorage,
  type AiInferenceSnapshot,
} from "@/lib/dataset/snapshot";
import { ANALYSIS_NOTES_MAX_LEN } from "@/lib/dataset/analysis-report-sections";
import {
  RadiologicalAiSummaryOneLine,
  RadiologicalAnalysisTimestamp,
  RadiologicalClinicalDetailCollapsible,
  RadiologicalMedicalDisclaimer,
  RadiologicalReadyBanner,
} from "@/components/dashboard/radiological-modality-blocks";

const FUNDUS_I18N: Record<Locale, Record<string, string>> = {
  tr: {
    microaneurysm: "Mikroanevrizma",
    hemorrhage: "Retinal hemoraji",
    hard_exudates: "Sert eksudalar",
    cotton_wool_spots: "Yumuşak eksudalar (CWS)",
    irma: "IRMA",
    venous_beading: "Venöz beading",
    neovascularization: "Neovaskülarizasyon",
    macular_edema_suspected: "Maküler ödem şüphesi (fundus)",
    cataract_effect: "Katarakt / görüntü kalitesi etkisi",
  },
  en: {
    microaneurysm: "Microaneurysm",
    hemorrhage: "Retinal hemorrhage",
    hard_exudates: "Hard exudates",
    cotton_wool_spots: "Cotton wool spots",
    irma: "IRMA",
    venous_beading: "Venous beading",
    neovascularization: "Neovascularization",
    macular_edema_suspected: "Macular edema suspected (fundus)",
    cataract_effect: "Cataract / image quality effect",
  },
};

function activeFundusLabels(findings: unknown, locale: Locale): string[] {
  if (!findings || typeof findings !== "object") return [];
  const map = FUNDUS_I18N[locale];
  return Object.entries(findings as Record<string, unknown>)
    .filter(([, v]) => v === true)
    .map(([k]) => map[k] || k);
}

function isPlaceholderOdirLabel(label: string): boolean {
  const l = label.trim();
  return (
    l.includes("Ek risk raporu yok") ||
    l.toLowerCase().includes("no additional risk") ||
    l === "Kararsiz" ||
    l === "Kararsız"
  );
}

/** Gecici: hipertansif retinopati ve AMD ODIR / ek risk ozetinde gosterilmez */
function isHtAmdOdirLabel(label: string): boolean {
  const s = label.trim().toLowerCase();
  if (
    s.includes("amd") ||
    s.includes("makula dejenerasyon") ||
    s.includes("macular degeneration")
  )
    return true;
  if (s.includes("hipertans") || s.includes("hypertensive")) return true;
  return false;
}

function visibleOdirResultRows(results: unknown): {
  label?: string;
  confidence?: number;
}[] {
  if (!Array.isArray(results)) return [];
  return results.filter(
    (r: { label?: string }) =>
      r?.label &&
      !isPlaceholderOdirLabel(String(r.label)) &&
      !isHtAmdOdirLabel(String(r.label)),
  );
}

function urgencyMessageKey(u: string | undefined): string {
  const x = (u || "routine").toLowerCase();
  if (x === "emergency") return "analysisCard.urgencyEmergency";
  if (x === "urgent") return "analysisCard.urgencyUrgent";
  return "analysisCard.urgencyRoutine";
}

const FUNDUS_CONFIDENCE_UNCERTAIN_THRESHOLD = 0.75;

/** Backend ODIR etiketleri (app.py ODIR_LABELS + Kararsiz) → analysisCard çeviri soneki */
const ODIR_LABEL_I18N_SUFFIX: Record<string, string> = {
  "Normal / Sağlıklı": "odirDisplay_normalHealthy",
  Glokom: "odirDisplay_glaucoma",
  Katarakt: "odirDisplay_cataract",
  Hipertansiyon: "odirDisplay_hypertension",
  "AMD (Yaşa Bağlı Makula Dejenerasyonu)": "odirDisplay_amd",
  Miyopi: "odirDisplay_myopia",
  "Diğer Göz Hastalıkları": "odirDisplay_other",
  Kararsiz: "odirDisplay_undecided",
  Kararsız: "odirDisplay_undecided",
};

function displayOdirLabel(
  raw: string,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  const suffix = ODIR_LABEL_I18N_SUFFIX[raw.trim()];
  if (suffix) return t(`analysisCard.${suffix}`);
  return raw;
}

type PatientReportInfo = {
  fullName?: string;
  tcNo?: string;
  age?: number;
};

export type AiAnalysisDraft = {
  aiResult: string;
  confidence: number;
  heatmapUrl?: string;
  originalImage?: string;
  aiOdriLabels?: string[];
  aiOdriConfidences?: number[];
  /** Tek seçim (geri uyumluluk); `correctionLabels` varsa göz ardı edilir */
  correctionLabel?: string;
  /** Birden fazla evre/hastalık düzeltmesi */
  correctionLabels?: string[];
  /** Fundus doktor geri bildirimi: NVD/NVE seçimi */
  fundusNvd?: boolean;
  fundusNve?: boolean;
  /** Doktorun yapılandırılmış fundus düzeltmesi */
  doctorStructuredReview?: Record<string, unknown>;
  /** Opsiyonel fundus analiz notları (radyolojik özet) */
  analysisNotes?: string;
  /** Veri seti: /predict yapısal çıktısı (heatmap base64 hariç) */
  aiInferenceSnapshot?: AiInferenceSnapshot | null;
};

type ImageAnalysisCardProps = {
  patientId?: string;
  patientInfo?: PatientReportInfo;
  doctorName?: string;
  compact?: boolean;
  onDraftChange?: (draft: AiAnalysisDraft | null) => void;
  /** Analiz başarılı olunca (ör. üst Collapsible’ı açık tutmak için) */
  onAnalysisSuccess?: () => void;
  /** AI analiz panelinde dış başlık kullanıldığında kart içi başlık gizlenir */
  suppressHeader?: boolean;
  className?: string;
};

export function ImageAnalysisCard({
  patientId,
  compact = false,
  onDraftChange,
  onAnalysisSuccess,
  suppressHeader = false,
  className,
}: ImageAnalysisCardProps) {
  const { t, locale } = useTranslation();
  const fundusFileInputId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [base64Image, setBase64Image] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  /** «Hayır» dalında tek fundus evre seçimi */
  const [correctionSelection, setCorrectionSelection] = useState<string>("");
  const [fundusNvd, setFundusNvd] = useState(false);
  const [fundusNve, setFundusNve] = useState(false);
  const [isAddedToForm, setIsAddedToForm] = useState(false);
  const [analysisCompletedAt, setAnalysisCompletedAt] = useState<Date | null>(
    null,
  );
  const [analysisNotes, setAnalysisNotes] = useState("");

  const { toast } = useToast();
  const isLowConfidenceResult =
    Number(result?.pytorch?.confidence ?? 0) <
    FUNDUS_CONFIDENCE_UNCERTAIN_THRESHOLD;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setResult(null);
    setIsCorrect(null);
    setCorrectionSelection("");
    setFundusNvd(false);
    setFundusNve(false);
    setIsAddedToForm(false);
    setAnalysisCompletedAt(null);
    setAnalysisNotes("");
    onDraftChange?.(null);

    const reader = new FileReader();
    reader.onloadend = () => setBase64Image(reader.result as string);
    reader.readAsDataURL(f);
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setIsLoading(true);
    const clientRid = crypto.randomUUID();
    try {
      const fd = new FormData();
      fd.append("image", file);
      if (patientId) {
        fd.append("patientId", patientId);
      }

      const res = await fetch("/api/ai/predict", {
        method: "POST",
        headers: { "x-request-id": clientRid },
        body: fd,
      });
      const data = (await res.json()) as Record<string, unknown>;
      if (res.ok && data.success) {
        setResult(data);
        setIsAddedToForm(false);
        setAnalysisCompletedAt(new Date());
        onAnalysisSuccess?.();
      } else if (data.queued) {
        toast({
          title: t("analysisCard.queueTitle"),
          description: t("analysisCard.queueDesc"),
        });
      } else {
        toast({
          variant: "destructive",
          title: t("errorPage.title"),
          description: t("analysisCard.serviceUnavailableRetry"),
        });
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logStructuredError({
        requestId: clientRid,
        route:
          typeof window !== "undefined"
            ? `${window.location.pathname}(client)`
            : "/api/ai/predict(client)",
        action:
          err instanceof SyntaxError
            ? "AI_ANALYZE_CLIENT_JSON"
            : "AI_ANALYZE_CLIENT",
        patientId,
        errorMessage: err.message,
        stack: err.stack,
        payloadSummary: JSON.stringify({
          fileName: file?.name,
          fileSize: file?.size,
        }),
      });
      toast({
        variant: "destructive",
        title: t("errorPage.title"),
        description:
          err.message && err.message !== t("analysisCard.analysisFail")
            ? err.message
            : t("analysisCard.gatewayFail"),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetAnalysis = () => {
    setFile(null);
    setPreviewUrl(null);
    setBase64Image(null);
    setResult(null);
    setIsCorrect(null);
    setCorrectionSelection("");
    setFundusNvd(false);
    setFundusNve(false);
    setIsAddedToForm(false);
    setAnalysisCompletedAt(null);
    setAnalysisNotes("");
    onDraftChange?.(null);
  };

  const publishDraft = () => {
    if (!result) return;
    const confidence = Number(result.pytorch?.confidence ?? 0);
    const lowConfidenceUncertain =
      Number.isFinite(confidence) &&
      confidence < FUNDUS_CONFIDENCE_UNCERTAIN_THRESHOLD;
    const uncertainLabel = locale === "tr" ? "Belirsiz" : "Uncertain";
    const resolvedStored = resolveDrLabelToStoredForm(result.pytorch?.label, locale);
    const aiResultStored = lowConfidenceUncertain
      ? uncertainLabel
      : resolvedStored ?? String(result.pytorch?.label || uncertainLabel).trim();
    const odirVisible = visibleOdirResultRows(result.odir?.results);
    const aiInferenceSnapshot = stripPredictResponseForStorage(result);
    const structuredReview =
      isCorrect === false
        ? {
            fundusAssessment: {
              neovascularization: {
                nvd: fundusNvd,
                nve: fundusNve,
              },
            },
          }
        : undefined;
    const draft: AiAnalysisDraft = {
      aiResult: aiResultStored,
      confidence: Number(result.pytorch?.confidence ?? 0),
      heatmapUrl: result.heatmapPlus,
      originalImage: base64Image || "",
      aiOdriLabels: odirVisible.map((r) => String(r.label ?? "")),
      aiOdriConfidences: odirVisible.map((r) => Number(r.confidence ?? 0)),
      correctionLabels:
        isCorrect === false && correctionSelection
          ? [correctionSelection]
          : undefined,
      fundusNvd: isCorrect === false ? fundusNvd : undefined,
      fundusNve: isCorrect === false ? fundusNve : undefined,
      doctorStructuredReview: structuredReview,
      analysisNotes: analysisNotes.trim() || undefined,
      aiInferenceSnapshot: aiInferenceSnapshot ?? undefined,
    };
    onDraftChange?.(draft);
    setIsAddedToForm(true);
    toast({
      title: t("analysisCard.addedTitle"),
      description: t("analysisCard.addedDesc"),
    });
  };

  return (
    <Card
      className={`w-full min-w-0 overflow-hidden border border-slate-200 bg-gradient-to-b from-slate-50 to-white ${
        compact ? "rounded-2xl shadow-md" : "rounded-3xl shadow-xl"
      }${className ? ` ${className}` : ""}`}
    >
      {!suppressHeader ? (
        <CardHeader
          className={`space-y-2 border-b border-slate-200 bg-white/90 ${
            compact ? "pb-3" : "pb-5"
          }`}
        >
          <CardTitle
            className={`font-semibold tracking-tight text-slate-900 ${
              compact ? "text-lg md:text-xl" : "text-2xl md:text-3xl"
            }`}
          >
            {t("analysisCard.title")}
          </CardTitle>
          <CardDescription
            className={`text-slate-600 ${compact ? "max-w-none text-xs md:text-sm" : "max-w-3xl text-sm md:text-base"}`}
          >
            {t("analysisCard.description")}
          </CardDescription>
        </CardHeader>
      ) : null}

      <CardContent
        className={`space-y-4 ${compact ? "p-3 md:p-4" : "p-4 md:p-6"}`}
      >
        {!previewUrl ? (
          compact ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1 space-y-1">
                <label
                  className="flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 text-xs text-slate-700"
                  htmlFor={fundusFileInputId}
                >
                  <Upload className="h-3.5 w-3.5" />
                  {t("analysisCard.pickImage")}
                </label>
                <input
                  id={fundusFileInputId}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            </div>
          ) : (
            <div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-cyan-300 bg-cyan-50/40 p-10 text-center transition-colors hover:border-cyan-400 hover:bg-cyan-50 md:p-14">
              <Upload className="mx-auto mb-4 h-12 w-12 text-cyan-700" />
              <p className="text-base font-semibold text-slate-800 md:text-lg">
                {t("analysisCard.pickImage")}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {t("analysisCard.supportedFormats")}
              </p>
              <input
                type="file"
                accept="image/*"
                className="absolute inset-0 cursor-pointer opacity-0"
                onChange={handleFileChange}
              />
            </div>
          )
        ) : (
          <>
            {compact && file ? (
              <p className="truncate text-[11px] text-slate-600">{file.name}</p>
            ) : null}
            <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-950">
              <div
                className={`relative w-full ${
                  compact
                    ? result
                      ? "h-[min(44vh,480px)] min-h-[260px] sm:min-h-[300px]"
                      : "h-[min(56vh,560px)] min-h-[320px] sm:min-h-[380px]"
                    : "h-[320px] md:h-[420px]"
                }`}
              >
                <Image
                  src={previewUrl}
                  alt="Preview"
                  fill
                  unoptimized
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-contain"
                />
              </div>
              <Button
                variant="destructive"
                size="icon"
                className="absolute right-3 top-3 h-9 w-9 rounded-xl"
                onClick={resetAnalysis}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}

        {compact && !result && (
          <Button
            className="h-9 w-full rounded-lg bg-[var(--retina-primary)] text-sm text-white"
            type="button"
            onClick={handleAnalyze}
            disabled={isLoading || !file}
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Zap className="mr-2 h-4 w-4" />
            )}
            {t("analysisCard.startAnalysis")}
          </Button>
        )}

        {result && (
          <div className="space-y-4">
            {compact ? (
              <>
                <RadiologicalMedicalDisclaimer className="text-[11px]" />
                {analysisCompletedAt ? (
                  <RadiologicalAnalysisTimestamp at={analysisCompletedAt} />
                ) : null}
              </>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs leading-relaxed text-slate-700">
                {t("analysisCard.clinicalAssistiveDisclaimer")}
              </div>
            )}

            <div className="space-y-4">
              <RadiologicalAiSummaryOneLine
                diseaseLabel={
                  Number(result.pytorch?.confidence ?? 0) <
                  FUNDUS_CONFIDENCE_UNCERTAIN_THRESHOLD
                    ? locale === "tr"
                      ? "Belirsiz"
                      : "Uncertain"
                    : drLabelTr(
                        result.pytorch?.label ||
                          (locale === "tr" ? "Belirsiz" : "Uncertain"),
                        locale,
                      )
                }
                confidencePct={Number(result.pytorch?.confidence || 0) * 100}
              />

              {result.heatmapPlus ? (
                <div className="mx-auto w-full max-w-[220px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 shadow-lg">
                  <div className="border-b border-slate-800 bg-slate-900/80 px-3 py-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.1em] text-cyan-200">
                    {t("analysisCard.heatmapTitle")}
                  </div>
                  <div className="relative aspect-square w-full max-h-[220px] min-h-[140px]">
                    <Image
                      src={result.heatmapPlus}
                      alt={t("analysisCard.heatmapAlt")}
                      fill
                      unoptimized
                      sizes="220px"
                      className="object-contain"
                    />
                  </div>
                </div>
              ) : null}
            </div>

            {(result.clinicalReasoning ||
              result.drLabel ||
              result.fundusFindings ||
              result.clinicalDecision ||
              result.dmeSuspected ||
              result.uncertaintyNote ||
              visibleOdirResultRows(result.odir?.results).length > 0) && (
              <RadiologicalClinicalDetailCollapsible
                title={
                  compact
                    ? t("radiologicalReport.clinicalDetailTitle")
                    : t("analysisCard.detailTitle")
                }
                defaultOpen
              >
              <div className="max-h-[min(56vh,480px)] space-y-4 overflow-y-auto text-sm md:space-y-5">

                {result.drLabel ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {t("analysisCard.modelLabelEn")}
                    </p>
                    <p className="mt-1 text-sm text-slate-800">
                      {isLowConfidenceResult
                        ? locale === "tr"
                          ? "Belirsiz"
                          : "Uncertain"
                        : String(result.drLabel)}
                    </p>
                  </div>
                ) : null}

                {result.dmeSuspected === true || result.dmeSuspected === false ? (
                  <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-900/80">
                      {t("analysisCard.dmeBlockTitle")}
                    </p>
                    <p className="mt-1 text-sm text-slate-800">
                      {isLowConfidenceResult
                        ? locale === "tr"
                          ? "Model guveni dusuk oldugu icin DME bulgusu belirsiz/supheli duzeyde yorumlanmalidir."
                          : "Because model confidence is low, DME finding should be interpreted as uncertain/suspected."
                        : result.dmeSuspected
                          ? t("analysisCard.dmeSuspectedYes")
                          : t("analysisCard.dmeSuspectedNo")}
                      {!isLowConfidenceResult &&
                      typeof result.dmeConfidence === "number"
                        ? ` — ${t("analysisCard.dmeConfidenceLabel")} ${(Number(result.dmeConfidence) * 100).toFixed(0)}%`
                        : null}
                    </p>
                  </div>
                ) : null}

                {result.uncertaintyNote ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {t("analysisCard.uncertaintyNoteTitle")}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                      {String(result.uncertaintyNote)}
                    </p>
                  </div>
                ) : null}

                {result.clinicalReasoning ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {t("analysisCard.clinicalReasoningTitle")}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                      {String(result.clinicalReasoning)}
                    </p>
                  </div>
                ) : null}

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t("analysisCard.fundusTitle")}
                  </p>
                  {activeFundusLabels(result.fundusFindings, locale).length >
                  0 ? (
                    <ul className="mt-2 list-inside list-disc text-sm text-slate-800">
                      {activeFundusLabels(result.fundusFindings, locale).map(
                        (label) => (
                          <li key={label}>{label}</li>
                        ),
                      )}
                    </ul>
                  ) : (
                    <p className="mt-1 text-sm text-slate-600">
                      {t("analysisCard.fundusNone")}
                    </p>
                  )}
                </div>

                {(() => {
                  const rows = visibleOdirResultRows(result.odir?.results);
                  return rows.length > 0 ? (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {t("analysisCard.extraRisks")}
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-slate-800">
                        {rows
                          .slice(0, 8)
                          .map(
                            (r: { label?: string; confidence?: number }) =>
                              `${displayOdirLabel(String(r.label || ""), t)} (%${(Number(r.confidence || 0) * 100).toFixed(0)})`,
                          )
                          .join(", ")}
                      </p>
                    </div>
                  ) : null;
                })()}

                {result.clinicalDecision &&
                typeof result.clinicalDecision === "object" ? (
                  <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {t("analysisCard.clinicalDecisionTitle")}
                    </p>
                    <dl className="mt-2 space-y-2 text-sm text-slate-800">
                      <div>
                        <dt className="text-slate-600">
                          {t("analysisCard.referableLabel")}
                        </dt>
                        <dd className="font-medium">
                          {(result.clinicalDecision as { referableDr?: boolean })
                            .referableDr
                            ? t("analysisCard.referableYes")
                            : t("analysisCard.referableNo")}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-600">
                          {t("analysisCard.urgencyLabel")}
                        </dt>
                        <dd className="font-medium">
                          {t(
                            urgencyMessageKey(
                              (result.clinicalDecision as { urgency?: string })
                                .urgency,
                            ),
                          )}
                        </dd>
                      </div>
                      {Array.isArray(
                        (result.clinicalDecision as { recommendedActions?: string[] })
                          .recommendedActions,
                      ) &&
                      (
                        result.clinicalDecision as {
                          recommendedActions?: string[];
                        }
                      ).recommendedActions!.length > 0 ? (
                        <div>
                          <dt className="text-slate-600">
                            {t("analysisCard.actionsTitle")}
                          </dt>
                          <dd>
                            <ul className="mt-1 list-inside list-disc">
                              {(
                                result.clinicalDecision as {
                                  recommendedActions?: string[];
                                }
                              ).recommendedActions!.map((a) => (
                                <li key={a}>{a}</li>
                              ))}
                            </ul>
                          </dd>
                        </div>
                      ) : null}
                      {(result.clinicalDecision as { followUpTr?: string })
                        .followUpTr ? (
                        <div>
                          <dt className="text-slate-600">
                            {t("analysisCard.followUpTitle")}
                          </dt>
                          <dd className="mt-1 whitespace-pre-wrap">
                            {String(
                              (result.clinicalDecision as { followUpTr?: string })
                                .followUpTr,
                            )}
                          </dd>
                        </div>
                      ) : null}
                    </dl>
                  </div>
                ) : null}
              </div>
              </RadiologicalClinicalDetailCollapsible>
            )}
          </div>
        )}

        {result ? (
          compact ? (
            <RadiologicalReadyBanner addedToReport={isAddedToForm} />
          ) : (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="h-4 w-4" />
                {isAddedToForm
                  ? t("analysisCard.addedShort")
                  : t("analysisCard.readyHint")}
              </div>
              <p className="mt-1 text-xs text-emerald-700">
                {isAddedToForm
                  ? t("analysisCard.addedFlowHint")
                  : t("analysisCard.validationHint")}
              </p>
            </div>
          )
        ) : null}
      </CardContent>

      {(result || !compact) && (
        <div
          className={`border-t border-slate-200 bg-slate-50/70 ${
            compact
              ? "px-3 pb-4 pt-4 md:px-4 md:pb-5"
              : "px-4 pb-6 pt-5 md:px-6 md:pb-8"
          }`}
        >
          {result ? (
          <div className="w-full space-y-4">
            <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 md:flex-row md:items-center md:justify-between md:p-5">
              <div className="flex items-center gap-3 text-slate-800">
                <span className="text-sm font-semibold uppercase tracking-[0.08em] md:text-base">
                  {t("analysisCard.isCorrect")}
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  className={`rounded-xl px-6 text-sm font-semibold ${
                    isCorrect === true
                      ? "bg-emerald-600 text-white hover:bg-emerald-700"
                      : "border border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50"
                  }`}
                  onClick={() => {
                    setIsCorrect(true);
                    setCorrectionSelection("");
                    setFundusNvd(false);
                    setFundusNve(false);
                    setIsAddedToForm(false);
                  }}
                >
                  {t("analysisCard.yesUpper")}
                </Button>
                <Button
                  className={`rounded-xl px-6 text-sm font-semibold ${
                    isCorrect === false
                      ? "bg-rose-600 text-white hover:bg-rose-700"
                      : "border border-rose-300 bg-white text-rose-700 hover:bg-rose-50"
                  }`}
                  onClick={() => {
                    setIsCorrect(false);
                    setCorrectionSelection("");
                    setFundusNvd(false);
                    setFundusNve(false);
                    setIsAddedToForm(false);
                  }}
                >
                  {t("analysisCard.noUpper")}
                </Button>
              </div>
            </div>

            {isCorrect === false && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-4">
                <span className="mb-2 block text-sm font-semibold uppercase tracking-[0.08em] text-rose-700">
                  {t("analysisCard.correctionTitle")}
                </span>
                <p className="mb-3 text-xs text-rose-800/90">
                  {t("analysisCard.correctionSingleHint")}
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(locale === "tr" ? DR_STAGE_LABELS_TR : DR_STAGE_LABELS_EN).map(
                    (label) => {
                      const v = label.trim();
                      const checked = correctionSelection === v;
                      return (
                        <label
                          key={v}
                          className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                            checked
                              ? "border-rose-400 bg-white shadow-sm"
                              : "border-rose-100 bg-white/80 hover:border-rose-200"
                          }`}
                        >
                          <input
                            type="radio"
                            name="fundus-correction"
                            checked={checked}
                            className="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                            onChange={() => {
                              setCorrectionSelection(v);
                              setIsAddedToForm(false);
                            }}
                          />
                          <span>{v}</span>
                        </label>
                      );
                    },
                  )}
                </div>
                <div className="mt-3 rounded-xl border border-rose-200/70 bg-white/70 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-rose-700">
                    {t("analysisCard.neovascularizationSelectionTitle")}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-rose-100 bg-white px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        checked={fundusNvd}
                        className="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                        onChange={(e) => {
                          setFundusNvd(e.target.checked);
                          setIsAddedToForm(false);
                        }}
                      />
                      <span>{t("analysisCard.nvdLabel")}</span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-rose-100 bg-white px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        checked={fundusNve}
                        className="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                        onChange={(e) => {
                          setFundusNve(e.target.checked);
                          setIsAddedToForm(false);
                        }}
                      />
                      <span>{t("analysisCard.nveLabel")}</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <label className="block text-sm font-medium text-slate-800">
                <span>{t("radiologicalReport.analysisNotesLabel")}</span>
                <span className="font-normal text-slate-500">
                  {" "}
                  ({t("radiologicalReport.optionalTag")})
                </span>
                <Textarea
                  value={analysisNotes}
                  onChange={(e) => {
                    setAnalysisNotes(e.target.value);
                    setIsAddedToForm(false);
                  }}
                  className="mt-2 min-h-[80px] text-sm"
                  placeholder={t("radiologicalReport.analysisNotesPlaceholder")}
                  maxLength={ANALYSIS_NOTES_MAX_LEN}
                />
                <span className="mt-1 block text-[11px] text-slate-500">
                  {analysisNotes.length}/{ANALYSIS_NOTES_MAX_LEN}
                </span>
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Button
                className="h-11 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-100"
                onClick={() => publishDraft()}
                disabled={
                  isCorrect === null ||
                  (isCorrect === false && !correctionSelection)
                }
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                {compact
                  ? t("radiologicalReport.appendToReport")
                  : t("analysisCard.pushToForm")}
              </Button>

              <Button
                className="h-11 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-100"
                onClick={resetAnalysis}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                {compact
                  ? t("radiologicalReport.clearModality")
                  : t("analysisCard.clear")}
              </Button>
            </div>
          </div>
          ) : (
            <Button
              className="h-13 w-full rounded-xl bg-cyan-700 text-base font-semibold text-white shadow-sm transition hover:bg-cyan-800"
              onClick={handleAnalyze}
              disabled={isLoading || !file}
              type="button"
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <Zap className="mr-2 h-5 w-5" />
              )}
              {t("analysisCard.startAnalysis")}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
