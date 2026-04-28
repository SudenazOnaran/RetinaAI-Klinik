"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/components/providers/i18n-provider";

export function RadiologicalMedicalDisclaimer({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <p
      className={cn(
        "rounded-lg border border-amber-100 bg-amber-50/80 px-3 py-2 text-xs leading-relaxed text-amber-950",
        className,
      )}
    >
      {t("radiologicalReport.medicalDisclaimerExact")}
    </p>
  );
}

export function RadiologicalAnalysisTimestamp({
  at,
  className,
}: {
  at: Date;
  className?: string;
}) {
  const { t, locale } = useTranslation();
  const formatted = new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(at);
  return (
    <p className={cn("text-[11px] text-slate-500", className)}>
      <span className="text-slate-600">{t("radiologicalReport.analysisCompletedAt")}</span>
      {": "}
      <span className="font-medium tabular-nums text-slate-800">{formatted}</span>
    </p>
  );
}

export function RadiologicalAiSummaryOneLine({
  diseaseLabel,
  confidencePct,
  confidenceTextOverride,
  className,
}: {
  diseaseLabel: string;
  confidencePct: number;
  confidenceTextOverride?: string | null;
  className?: string;
}) {
  const { t } = useTranslation();
  const pct = Number.isFinite(confidencePct) ? confidencePct : 0;
  const confidenceText =
    confidenceTextOverride && confidenceTextOverride.trim().length > 0
      ? confidenceTextOverride.trim()
      : `${t("radiologicalReport.confidenceApproxShort")} %${pct.toFixed(0)}`;
  return (
    <div
      className={cn(
        "rounded-xl border border-cyan-200/80 bg-gradient-to-br from-cyan-800 via-slate-900 to-slate-950 p-3 text-white shadow-md md:p-4",
        className,
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-cyan-200">
        {t("radiologicalReport.aiSummaryLabel")}
      </p>
      <p className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-xl font-bold leading-tight md:text-2xl [overflow-wrap:anywhere]">
          {diseaseLabel.trim() ? diseaseLabel : "—"}
        </span>
        <span className="text-sm text-cyan-100">
          · {confidenceText}
        </span>
      </p>
    </div>
  );
}

export function RadiologicalReadyBanner({
  addedToReport,
  className,
}: {
  addedToReport: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <div
      className={cn(
        "rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900",
        className,
      )}
    >
      <p className="font-medium">{t("radiologicalReport.readyBannerTitle")}</p>
      <p className="mt-1 text-xs text-emerald-800">
        {addedToReport
          ? t("radiologicalReport.readyBannerAddedBody")
          : t("radiologicalReport.readyBannerBody")}
      </p>
    </div>
  );
}

export function octLikelihoodToApproxConfidencePct(likelihood: string): number {
  const x = (likelihood || "low").toLowerCase();
  if (x === "high") return 85;
  if (x === "moderate") return 62;
  return 38;
}

export type LikelihoodNamedRow = { name: string; likelihood: string };

function isElevatedLikelihood(raw: string | null | undefined): boolean {
  const x = String(raw || "")
    .trim()
    .toLowerCase();
  return x === "high" || x === "moderate";
}

/**
 * En yüksek olasılıklı satırı döndürür; yalnızca moderate/high olanlar dikkate alınır.
 * Tüm satırlar düşük olasılıkta ise `null` (özet: «sağlıklı» gösterimi için).
 */
export function pickHighestLikelihoodNamedRow<T extends LikelihoodNamedRow>(
  rows: T[] | undefined,
): T | null {
  if (!rows?.length) return null;
  const elevated = rows.filter((r) => isElevatedLikelihood(r.likelihood));
  if (!elevated.length) return null;
  const rank = (l: string) => {
    const x = (l || "low").toLowerCase();
    if (x === "high") return 3;
    if (x === "moderate") return 2;
    return 1;
  };
  return [...elevated].sort((a, b) => rank(b.likelihood) - rank(a.likelihood))[0];
}

/** API `confidenceScore`: 0–1 veya yüzde olabilir → gösterim için 0–100 */
export function normalizePercentScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  if (score > 0 && score <= 1) return score * 100;
  return Math.min(100, Math.max(0, score));
}

/** Klinik detay blokları için hastane tarzı aç/kapa */
export function RadiologicalClinicalDetailCollapsible({
  title,
  defaultOpen = true,
  children,
  className,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const { t } = useTranslation();
  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={cn(
        "overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm",
        className,
      )}
    >
      <CollapsibleTrigger
        type="button"
        className="flex w-full items-center justify-between gap-3 bg-[#f8fafc] px-4 py-3 text-left transition-colors hover:bg-slate-100/90"
        aria-expanded={open}
      >
        <span className="text-sm font-semibold text-slate-900">{title}</span>
        <span className="flex items-center gap-2 text-[11px] font-medium text-slate-500">
          <span className="hidden sm:inline">
            {open ? t("radiologicalReport.collapseSection") : t("radiologicalReport.expandSection")}
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-slate-600 transition-transform duration-200",
              open && "rotate-180",
            )}
          />
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t border-slate-100 px-4 pb-4 pt-3">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
