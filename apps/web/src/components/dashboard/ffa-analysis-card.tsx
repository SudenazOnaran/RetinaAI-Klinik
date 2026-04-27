"use client";

import { useId, useState } from "react";
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
import { Loader2, Upload, X, Radio } from "lucide-react";
import { useTranslation } from "@/components/providers/i18n-provider";
import { logStructuredError } from "@/lib/structured-error-log";
import { buildFfaTextForReport } from "@/lib/ai-modality-report-text";

type FfaDisease = {
  name: string;
  likelihood: string;
  supportingFindings: string[];
  contradictingFindings: string[];
};

export type FfaPayload = {
  imageQuality: string;
  phaseAssessment: string;
  findings: string[];
  diseases: FfaDisease[];
  activity: {
    activeDisease: string;
    neovascularization: string;
    leakage: string;
  };
  clinicalSummary: string;
  recommendations: string[];
  confidenceScore: number;
};

const LIKELIHOOD_KEYS = ["low", "moderate", "high"] as const;

function displayLikelihood(norm: string, t: (k: string) => string): string {
  const x = (norm || "low").toLowerCase();
  if (x === "moderate") return t("ffaAnalysis.likelihoodModerate");
  if (x === "high") return t("ffaAnalysis.likelihoodHigh");
  return t("ffaAnalysis.likelihoodLow");
}

type FfaAnalysisCardProps = {
  patientId: string;
  variant?: "full" | "panel";
  onAppendToReport?: (text: string) => void;
};

export function FfaAnalysisCard({
  patientId,
  variant = "full",
  onAppendToReport,
}: FfaAnalysisCardProps) {
  const isPanel = variant === "panel";
  const { t, locale } = useTranslation();
  const { toast } = useToast();
  const inputId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<FfaPayload | null>(null);
  const [doctorFeedback, setDoctorFeedback] = useState("");

  const showReportActions = Boolean(onAppendToReport && isPanel);
  const fileInputId = `ffa-file-${inputId}`;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setResult(null);
    setDoctorFeedback("");
  };

  const clearAll = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setResult(null);
    setDoctorFeedback("");
  };

  const handleAppend = () => {
    if (!result) return;
    if (!onAppendToReport) return;
    const text = buildFfaTextForReport(
      result,
      doctorFeedback,
      t as (k: string, o?: Record<string, string | number>) => string,
    );
    onAppendToReport(text);
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
      fd.append("image", file);
      fd.append("patientId", patientId);
      fd.append("locale", locale === "tr" ? "tr" : "en");

      const res = await fetch("/api/ai/predict-ffa", {
        method: "POST",
        headers: { "x-request-id": clientRid },
        body: fd,
      });
      const data = (await res.json()) as Record<string, unknown>;
      if (res.ok && data.success) {
        const ffa = data.ffa as FfaPayload | undefined;
        if (ffa && typeof ffa === "object" && ffa.activity) {
          setResult(ffa);
        } else {
          toast({
            variant: "destructive",
            title: t("errorPage.title"),
            description: t("ffaAnalysis.parseFail"),
          });
        }
      } else if (data.queued) {
        toast({
          title: t("analysisCard.queueTitle"),
          description: t("analysisCard.queueDesc"),
        });
      } else {
        const detail = String(
          data.error || data.message || t("ffaAnalysis.analysisFail"),
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
        route: `${typeof window !== "undefined" ? window.location.pathname : ""}(ffa-client)`,
        action: "AI_FFA_CLIENT",
        patientId,
        errorMessage: err.message,
        stack: err.stack,
        payloadSummary: JSON.stringify({ fileName: file?.name, fileSize: file?.size }),
      });
      toast({
        variant: "destructive",
        title: t("errorPage.title"),
        description: t("ffaAnalysis.analysisFail"),
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card
      className={
        isPanel
          ? "border border-slate-200 bg-white shadow-sm"
          : "border border-[#d8e0df] bg-white shadow-sm"
      }
    >
      {isPanel ? (
        <div className="border-b border-slate-100 bg-[#f8f9fc] px-3 py-2">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-700">
            {t("aiAnalysisPanel.ffaShort")}
          </p>
          <p className="text-[11px] text-slate-500">{t("ffaAnalysis.title")}</p>
        </div>
      ) : (
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="flex items-center gap-2 text-slate-900">
            <Radio className="h-5 w-5 text-[var(--retina-primary)]" />
            {t("ffaAnalysis.title")}
          </CardTitle>
          <CardDescription>{t("ffaAnalysis.description")}</CardDescription>
        </CardHeader>
      )}
      <CardContent className="space-y-3 pt-3">
        <p
          className={
            isPanel
              ? "rounded-md border border-amber-100 bg-amber-50/80 px-2 py-1.5 text-[11px] text-amber-950"
              : "rounded-lg border border-amber-100 bg-amber-50/80 px-3 py-2 text-xs text-amber-950"
          }
        >
          {t("ffaAnalysis.disclaimer")}
        </p>

        {!previewUrl ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 space-y-1">
              <label
                className="flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 text-xs text-slate-700"
                htmlFor={fileInputId}
              >
                <Upload className="h-3.5 w-3.5" />
                {t("ffaAnalysis.selectImage")}
              </label>
              <input
                id={fileInputId}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/bmp"
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
                    ? "relative h-[min(40vh,380px)] min-h-[220px] w-full sm:min-h-[260px]"
                    : "relative h-[min(52vh,480px)] min-h-[300px] w-full sm:min-h-[360px]"
                }
              >
                <Image
                  src={previewUrl}
                  alt="FFA preview"
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
                aria-label={t("ffaAnalysis.clearImage")}
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
              {t("ffaAnalysis.analyzing")}
            </>
          ) : (
            t("ffaAnalysis.analyze")
          )}
        </Button>

        {result ? (
          <div className="max-h-[min(50vh,360px)] space-y-3 overflow-y-auto border-t border-slate-200 pt-3 text-sm text-slate-800">
            <div className="flex flex-wrap gap-2 text-xs">
              <div>
                <p className="text-[10px] font-semibold uppercase text-slate-500">
                  {t("ffaAnalysis.imageQuality")}
                </p>
                <p className="mt-0.5">{result.imageQuality}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase text-slate-500">
                  {t("ffaAnalysis.phaseAssessment")}
                </p>
                <p className="mt-0.5">{result.phaseAssessment}</p>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase text-slate-500">
                {t("ffaAnalysis.confidenceScore")}
              </p>
              <p className="mt-0.5 font-mono text-sm text-slate-900">
                {Number.isFinite(result.confidenceScore)
                  ? result.confidenceScore
                  : "—"}
              </p>
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase text-slate-500">
                {t("ffaAnalysis.findings")}
              </p>
              <ul className="mt-0.5 list-inside list-disc space-y-0.5 text-xs">
                {result.findings.length > 0
                  ? result.findings.map((f, i) => (
                      <li key={i} className="[overflow-wrap:anywhere]">
                        {f}
                      </li>
                    ))
                  : <li className="text-slate-500">—</li>}
              </ul>
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase text-slate-500">
                {t("ffaAnalysis.diseases")}
              </p>
              <div className="mt-1 space-y-2">
                {result.diseases.length > 0 ? (
                  result.diseases.map((c, i) => {
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
                              {t("ffaAnalysis.supporting")}{" "}
                            </span>
                            {c.supportingFindings.join(" · ")}
                          </p>
                        ) : null}
                        {c.contradictingFindings.length > 0 ? (
                          <p className="mt-1 text-[11px] text-slate-600">
                            <span className="font-semibold text-slate-700">
                              {t("ffaAnalysis.contradicting")}{" "}
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
                {t("ffaAnalysis.activityTitle")}
              </p>
              <div className="mt-1 grid gap-1 rounded border border-slate-200 bg-white p-2 text-[11px] sm:grid-cols-3">
                <p>
                  <span className="font-semibold text-slate-700">
                    {t("ffaAnalysis.activeDisease")}:{" "}
                  </span>
                  {result.activity.activeDisease}
                </p>
                <p>
                  <span className="font-semibold text-slate-700">
                    {t("ffaAnalysis.neovascularization")}:{" "}
                  </span>
                  {result.activity.neovascularization}
                </p>
                <p>
                  <span className="font-semibold text-slate-700">
                    {t("ffaAnalysis.leakage")}:{" "}
                  </span>
                  {result.activity.leakage}
                </p>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase text-slate-500">
                {t("ffaAnalysis.clinicalSummary")}
              </p>
              <p className="mt-0.5 whitespace-pre-wrap text-xs [overflow-wrap:anywhere]">
                {result.clinicalSummary || "—"}
              </p>
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase text-slate-500">
                {t("ffaAnalysis.recommendations")}
              </p>
              <ul className="mt-0.5 list-inside list-decimal text-xs">
                {result.recommendations.length > 0
                  ? result.recommendations.map((r, i) => (
                      <li key={i} className="[overflow-wrap:anywhere]">
                        {r}
                      </li>
                    ))
                  : <li className="text-slate-500">—</li>}
              </ul>
            </div>

            {showReportActions ? (
              <div className="space-y-2 border-t border-slate-200 pt-3">
                <label className="block text-[11px] font-medium text-slate-700">
                  {t("aiAnalysisPanel.doctorFeedbackLabel")}
                  <Textarea
                    value={doctorFeedback}
                    onChange={(e) => setDoctorFeedback(e.target.value)}
                    className="mt-1 min-h-[56px] text-xs"
                    placeholder={t("aiAnalysisPanel.doctorFeedbackPlaceholder")}
                    maxLength={800}
                  />
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    className="h-9 flex-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                    onClick={handleAppend}
                  >
                    {t("aiAnalysisPanel.addToReport")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 flex-1"
                    onClick={clearAll}
                  >
                    {t("aiAnalysisPanel.clearModality")}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
