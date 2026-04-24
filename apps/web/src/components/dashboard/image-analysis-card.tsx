"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
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
  correctionLabel?: string;
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
};

export function ImageAnalysisCard({
  patientId,
  compact = false,
  onDraftChange,
  onAnalysisSuccess,
}: ImageAnalysisCardProps) {
  const { t, locale } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [base64Image, setBase64Image] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [actualResult, setActualResult] = useState("");
  const [isAddedToForm, setIsAddedToForm] = useState(false);

  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setResult(null);
    setIsCorrect(null);
    setActualResult("");
    setIsAddedToForm(false);
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
        onAnalysisSuccess?.();
      } else if (data.queued) {
        toast({
          title: t("analysisCard.queueTitle"),
          description: t("analysisCard.queueDesc"),
        });
      } else {
        const detail = String(
          data.error || data.message || t("analysisCard.analysisFail"),
        );
        toast({
          variant: "destructive",
          title: t("errorPage.title"),
          description: detail,
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
    setActualResult("");
    setIsAddedToForm(false);
    onDraftChange?.(null);
  };

  const publishDraft = (correction?: string) => {
    if (!result) return;
    const aiResultStored =
      resolveDrLabelToStoredForm(result.pytorch?.label, locale) ??
      getStorageDrLabel(0, locale);
    const odirVisible = visibleOdirResultRows(result.odir?.results);
    const aiInferenceSnapshot = stripPredictResponseForStorage(result);
    const draft: AiAnalysisDraft = {
      aiResult: aiResultStored,
      confidence: Number(result.pytorch?.confidence ?? 0),
      heatmapUrl: result.heatmapPlus,
      originalImage: base64Image || "",
      aiOdriLabels: odirVisible.map((r) => String(r.label ?? "")),
      aiOdriConfidences: odirVisible.map((r) => Number(r.confidence ?? 0)),
      correctionLabel: correction?.trim() || undefined,
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
      }`}
    >
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

      <CardContent
        className={`space-y-4 ${compact ? "p-3 md:p-4" : "p-4 md:p-6"}`}
      >
        {!previewUrl ? (
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
        ) : (
          <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-950">
            <div
              className={`relative w-full ${compact ? "h-[240px] md:h-[280px]" : "h-[320px] md:h-[420px]"}`}
            >
              <Image
                src={previewUrl}
                alt="Preview"
                fill
                unoptimized
                sizes="(max-width: 768px) 100vw, 900px"
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
        )}

        {result && (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs leading-relaxed text-slate-700">
              {t("analysisCard.clinicalAssistiveDisclaimer")}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-cyan-100 bg-gradient-to-br from-cyan-700 to-blue-700 p-5 text-white shadow-lg">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-100">
                  {t("analysisCard.summary")}
                </p>
                <p className="mt-3 text-3xl font-bold leading-tight">
                  {drLabelTr(
                    result.pytorch?.label || getStorageDrLabel(0, locale),
                    locale,
                  )}
                </p>
                <p className="mt-4 rounded-lg bg-white/15 px-3 py-2 text-sm font-medium">
                  {t("analysisCard.confidencePrefix")}
                  {(Number(result.pytorch?.confidence || 0) * 100).toFixed(1)}
                </p>

                {(() => {
                  const rows = visibleOdirResultRows(result.odir?.results);
                  return rows.length > 0 ? (
                    <div className="mt-3 rounded-lg bg-white/10 px-3 py-2 text-xs text-cyan-100">
                      {t("analysisCard.extraRisks")}{" "}
                      {rows
                        .slice(0, 6)
                        .map(
                          (r: { label?: string; confidence?: number }) =>
                            `${displayOdirLabel(String(r.label || ""), t)} (%${(Number(r.confidence || 0) * 100).toFixed(0)})`,
                        )
                        .join(", ")}
                    </div>
                  ) : null;
                })()}
              </div>

              {result.heatmapPlus ? (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 shadow-lg">
                  <div className="border-b border-slate-800 bg-slate-900/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-cyan-200">
                    {t("analysisCard.heatmapTitle")}
                  </div>
                  <div
                    className={`relative w-full ${compact ? "h-[220px] md:h-[250px]" : "h-[260px] md:h-[300px]"}`}
                  >
                    <Image
                      src={result.heatmapPlus}
                      alt={t("analysisCard.heatmapAlt")}
                      fill
                      unoptimized
                      sizes="(max-width: 768px) 100vw, 900px"
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
              result.uncertaintyNote) && (
              <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
                <p className="text-sm font-semibold text-slate-900">
                  {t("analysisCard.detailTitle")}
                </p>

                {result.drLabel ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {t("analysisCard.modelLabelEn")}
                    </p>
                    <p className="mt-1 text-sm text-slate-800">
                      {String(result.drLabel)}
                    </p>
                  </div>
                ) : null}

                {result.dmeSuspected === true || result.dmeSuspected === false ? (
                  <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-900/80">
                      {t("analysisCard.dmeBlockTitle")}
                    </p>
                    <p className="mt-1 text-sm text-slate-800">
                      {result.dmeSuspected
                        ? t("analysisCard.dmeSuspectedYes")
                        : t("analysisCard.dmeSuspectedNo")}
                      {typeof result.dmeConfidence === "number"
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
            )}
          </div>
        )}

        {result ? (
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
        ) : null}
      </CardContent>

      <div
        className={`border-t border-slate-200 bg-slate-50/70 ${
          compact
            ? "px-3 pb-4 pt-4 md:px-4 md:pb-5"
            : "px-4 pb-6 pt-5 md:px-6 md:pb-8"
        }`}
      >
        {!result ? (
          <Button
            className="h-13 w-full rounded-xl bg-cyan-700 text-base font-semibold text-white shadow-sm transition hover:bg-cyan-800"
            onClick={handleAnalyze}
            disabled={isLoading || !file}
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <Zap className="mr-2 h-5 w-5" />
            )}
            {t("analysisCard.startAnalysis")}
          </Button>
        ) : (
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
                    setActualResult("");
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
                <select
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium outline-none transition focus:border-cyan-500"
                  value={actualResult}
                  onChange={(e) => {
                    const next = e.target.value;
                    setActualResult(next);
                    setIsAddedToForm(false);
                  }}
                >
                  <option value="">{t("analysisCard.correctionPlaceholder")}</option>
                  {(locale === "tr" ? DR_STAGE_LABELS_TR : DR_STAGE_LABELS_EN).map(
                    (label) => (
                      <option key={label} value={label}>
                        {label.trim()}
                      </option>
                    ),
                  )}
                </select>
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              <Button
                className="h-11 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-100"
                onClick={() => publishDraft(actualResult || undefined)}
                disabled={
                  isCorrect === null || (isCorrect === false && !actualResult)
                }
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                {t("analysisCard.pushToForm")}
              </Button>

              <Button
                className="h-11 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-100"
                onClick={resetAnalysis}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                {t("analysisCard.clear")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
