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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import {
  Upload,
  X,
  Loader2,
  Zap,
  CheckCircle2,
  RefreshCw,
  ChevronDown,
} from "lucide-react";
import { drLabelTr } from "@/lib/dr-label-tr";
import { useTranslation } from "@/components/providers/i18n-provider";

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
};

type ImageAnalysisCardProps = {
  patientId?: string;
  patientInfo?: PatientReportInfo;
  doctorName?: string;
  compact?: boolean;
  onDraftChange?: (draft: AiAnalysisDraft | null) => void;
};

export function ImageAnalysisCard({
  patientId,
  compact = false,
  onDraftChange,
}: ImageAnalysisCardProps) {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [base64Image, setBase64Image] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [actualResult, setActualResult] = useState("");
  const [isAddedToForm, setIsAddedToForm] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

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
    setShowAdvanced(false);
    onDraftChange?.(null);

    const reader = new FileReader();
    reader.onloadend = () => setBase64Image(reader.result as string);
    reader.readAsDataURL(f);
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setIsLoading(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      if (patientId) {
        fd.append("patientId", patientId);
      }

      const res = await fetch("/api/ai/predict", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setResult(data);
        setIsAddedToForm(false);
        setShowAdvanced(false);
      } else if (data.queued) {
        toast({
          title: t("analysisCard.queueTitle"),
          description: t("analysisCard.queueDesc"),
        });
      } else {
        throw new Error(data.error || data.message || t("analysisCard.analysisFail"));
      }
    } catch {
      toast({
        variant: "destructive",
        title: t("errorPage.title"),
        description: t("analysisCard.gatewayFail"),
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
    setShowAdvanced(false);
    onDraftChange?.(null);
  };

  const publishDraft = (correction?: string) => {
    if (!result) return;
    const draft: AiAnalysisDraft = {
      aiResult: result.pytorch?.label || "No_DR",
      confidence: Number(result.pytorch?.confidence ?? 0),
      heatmapUrl: result.heatmapPlus,
      originalImage: base64Image || "",
      aiOdriLabels: Array.isArray(result.odir?.results)
        ? result.odir.results.map((r: any) => r.label)
        : [],
      aiOdriConfidences: Array.isArray(result.odir?.results)
        ? result.odir.results.map((r: any) => Number(r.confidence ?? 0))
        : [],
      correctionLabel: correction,
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
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-cyan-100 bg-gradient-to-br from-cyan-700 to-blue-700 p-5 text-white shadow-lg">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-100">
                  {t("analysisCard.summary")}
                </p>
                <p className="mt-3 text-3xl font-bold leading-tight">
                  {drLabelTr(result.pytorch?.label || "No_DR")}
                </p>
                <p className="mt-4 rounded-lg bg-white/15 px-3 py-2 text-sm font-medium">
                  {t("analysisCard.confidencePrefix")}
                  {(Number(result.pytorch?.confidence || 0) * 100).toFixed(1)}
                </p>

                {Array.isArray(result.odir?.results) &&
                result.odir.results.length > 0 ? (
                  <div className="mt-3 rounded-lg bg-white/10 px-3 py-2 text-xs text-cyan-100">
                    {t("analysisCard.extraRisks")}{" "}
                    {result.odir.results
                      .slice(0, 3)
                      .map(
                        (r: any) =>
                          `${r.label} (%${(Number(r.confidence || 0) * 100).toFixed(0)})`,
                      )
                      .join(", ")}
                  </div>
                ) : null}
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

            <Collapsible
              open={showAdvanced}
              onOpenChange={setShowAdvanced}
              className="rounded-xl border border-slate-200 bg-white"
            >
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-slate-700"
                >
                  <span>{t("analysisCard.advancedTitle")}</span>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${showAdvanced ? "rotate-180" : ""}`}
                  />
                </button>
              </CollapsibleTrigger>

              <CollapsibleContent className="space-y-4 border-t border-slate-100 p-4">
                {Array.isArray(result.odir?.results) &&
                result.odir.results.length > 0 ? (
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-800">
                      {t("analysisCard.odirTitle")}
                    </p>
                    <div className="mt-3 space-y-2">
                      {result.odir.results.map((r: any, i: number) => (
                        <div
                          key={i}
                          className="flex items-center justify-between rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm"
                        >
                          <span className="font-medium text-slate-800">
                            {r.label}
                          </span>
                          <span className="font-semibold text-emerald-700">
                            {(Number(r.confidence || 0) * 100).toFixed(1)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {result.uncertainty || result.ood ? (
                  <div className="rounded-xl border border-amber-100 bg-amber-50/70 p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-800">
                      {t("analysisCard.reliabilityTitle")}
                    </p>
                    <div className="mt-2 space-y-1 text-sm text-slate-700">
                      <p>
                        {t("analysisCard.predictiveEntropy")}{" "}
                        {Number(
                          result.uncertainty?.predictiveEntropy || 0,
                        ).toFixed(4)}
                      </p>
                      <p>
                        {t("analysisCard.mutualInformation")}{" "}
                        {Number(
                          result.uncertainty?.mutualInformation || 0,
                        ).toFixed(4)}
                      </p>
                      <p>
                        {t("analysisCard.classVariance")}{" "}
                        {Number(result.uncertainty?.classVariance || 0).toFixed(
                          6,
                        )}
                      </p>
                      <p>
                        {t("analysisCard.oodScore")}
                        {(Number(result.ood?.score || 0) * 100).toFixed(1)}
                      </p>
                    </div>
                  </div>
                ) : null}

                {result.localization ? (
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-indigo-800">
                      {t("analysisCard.localizationTitle")}
                    </p>
                    <div className="mt-2 space-y-1 text-sm text-slate-700">
                      <p>
                        IoU: {Number(result.localization.iou || 0).toFixed(4)}
                      </p>
                      <p>
                        Dice: {Number(result.localization.dice || 0).toFixed(4)}
                      </p>
                      <p>
                        {t("analysisCard.pointingHit")}{" "}
                        {result.localization.pointingHit
                          ? t("analysisCard.yes")
                          : t("analysisCard.no")}
                      </p>
                    </div>
                  </div>
                ) : null}

                {result.heatmapPlus ? (
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950 shadow-sm">
                    <div className="border-b border-slate-800 bg-slate-900/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-cyan-200">
                      {t("analysisCard.gradcam")}
                    </div>
                    <div
                      className={`relative w-full ${compact ? "h-[220px] md:h-[250px]" : "h-[280px] md:h-[320px]"}`}
                    >
                      <Image
                        src={result.heatmapPlus}
                      alt={t("analysisCard.gradcamAlt")}
                        fill
                        unoptimized
                        sizes="(max-width: 768px) 100vw, 900px"
                        className="object-contain"
                      />
                    </div>
                  </div>
                ) : null}
              </CollapsibleContent>
            </Collapsible>
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
                  {["Mild", "Moderate", "Severe"].map((c) => (
                    <option key={c} value={c}>
                      {drLabelTr(c)}
                    </option>
                  ))}
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
