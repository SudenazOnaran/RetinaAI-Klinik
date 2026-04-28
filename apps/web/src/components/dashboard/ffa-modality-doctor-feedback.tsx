"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/components/providers/i18n-provider";
import {
  decodeModalityAiAlignedLabel,
  encodeModalityAiAlignedLabel,
  isDoctorApprovalToken,
  isModalityDisagreePending,
  MODALITY_DISAGREE_PENDING,
} from "@/lib/doctor-feedback";
import {
  DR_STAGE_LABELS_EN,
  DR_STAGE_LABELS_TR,
  getStorageDrLabel,
  type DrStageIndex,
} from "@/lib/dr-stage-labels";
import { cn } from "@/lib/utils";
import type { mergeFfaStaticWithDiseases } from "@/lib/modality-risk-surface";
import { FFA_HEALTHY_VALUE } from "@/lib/modality-risk-surface";
import {
  encodeFfaDoctorFeedbackV3,
  tryParseFfaDoctorFeedbackAny,
  tryParseFfaDoctorFeedbackV2,
  type FfaDoctorFeedbackV3,
} from "@/lib/ffa-doctor-feedback-json";

const DR_IDX: DrStageIndex[] = [0, 1, 2, 3, 4];

type MergedFfa = ReturnType<typeof mergeFfaStaticWithDiseases>;

type FfaModalityDoctorFeedbackProps = {
  value: string;
  onChange: (value: string) => void;
  mergedRows: MergedFfa;
  /** «Evet» ile saklanacak AI tanı özeti (tek satır düz metin). */
  approvalAiSummaryLabel?: string;
  className?: string;
};

function sortDiagStable(arr: string[]): string[] {
  return [...arr].sort((a, b) => a.localeCompare(b));
}

export function FfaModalityDoctorFeedback({
  value,
  onChange,
  mergedRows,
  approvalAiSummaryLabel,
  className,
}: FfaModalityDoctorFeedbackProps) {
  const { t, locale } = useTranslation();
  const [agree, setAgree] = useState<boolean | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selStage, setSelStage] = useState<string | null>(null);

  const drNeeded = selected.has("ffa_dr");

  const persistDiagSelections = useCallback(
    (nextSel: Set<string>, stageForDr: string | null) => {
      const arr = sortDiagStable([...nextSel]).filter(Boolean);
      if (!arr.length) {
        onChange(MODALITY_DISAGREE_PENDING);
        return;
      }
      if (arr.includes(FFA_HEALTHY_VALUE)) {
        if (arr.length > 1) {
          onChange(MODALITY_DISAGREE_PENDING);
          return;
        }
        const payload: FfaDoctorFeedbackV3 = {
          v: 3,
          diagnoses: [FFA_HEALTHY_VALUE],
          drStage: null,
        };
        onChange(encodeFfaDoctorFeedbackV3(payload));
        return;
      }
      if (arr.includes("ffa_dr")) {
        const st = String(stageForDr ?? "").trim();
        if (!st) {
          onChange(MODALITY_DISAGREE_PENDING);
          return;
        }
        const payload: FfaDoctorFeedbackV3 = {
          v: 3,
          diagnoses: arr,
          drStage: st,
        };
        onChange(encodeFfaDoctorFeedbackV3(payload));
        return;
      }
      const payload: FfaDoctorFeedbackV3 = {
        v: 3,
        diagnoses: arr,
        drStage: null,
      };
      onChange(encodeFfaDoctorFeedbackV3(payload));
    },
    [onChange],
  );

  const syncFromValue = useCallback(
    (v: string) => {
      const t0 = v.trim();
      if (!t0) {
        setAgree(null);
        setSelected(new Set());
        setSelStage(null);
        return;
      }
      if (isModalityDisagreePending(t0)) {
        setAgree(false);
        return;
      }
      if (decodeModalityAiAlignedLabel(t0)) {
        setAgree(true);
        setSelected(new Set());
        setSelStage(null);
        return;
      }
      if (isDoctorApprovalToken(t0)) {
        setAgree(true);
        setSelected(new Set());
        setSelStage(null);
        return;
      }
      setAgree(false);
      const parsedAny = tryParseFfaDoctorFeedbackAny(t0);
      if (parsedAny?.v === 3) {
        setSelected(new Set(parsedAny.diagnoses));
        setSelStage(
          parsedAny.diagnoses.includes("ffa_dr")
            ? String(parsedAny.drStage ?? "").trim() || null
            : null,
        );
        return;
      }
      const p2 = tryParseFfaDoctorFeedbackV2(t0);
      if (p2) {
        setSelected(new Set([p2.diagnosis]));
        setSelStage(
          p2.diagnosis === "ffa_dr"
            ? String(p2.drStage ?? "").trim() || null
            : null,
        );
        return;
      }
      setSelected(new Set());
      setSelStage(null);
    },
    [],
  );

  useEffect(() => {
    syncFromValue(value);
  }, [value, syncFromValue]);

  const toggleCode = (code: string) => {
    const next = new Set(selected);
    if (code === FFA_HEALTHY_VALUE) {
      if (next.has(FFA_HEALTHY_VALUE)) {
        next.delete(FFA_HEALTHY_VALUE);
      } else {
        next.clear();
        next.add(FFA_HEALTHY_VALUE);
      }
    } else {
      next.delete(FFA_HEALTHY_VALUE);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
    }
    let nextStage = selStage;
    if (!next.has("ffa_dr")) {
      nextStage = null;
    }
    setSelected(next);
    setSelStage(nextStage);
    persistDiagSelections(next, nextStage);
  };

  const itemsForPicker = mergedRows.map((row) => ({
    value: row.value,
    label: t(`modalityDisagree.ffa.${row.valueKey}` as never),
  }));

  const yesSnapshot = approvalAiSummaryLabel?.trim();

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between md:p-5">
        <span className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-800">
          {t("analysisCard.isCorrect")}
        </span>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            className={cn(
              "rounded-xl px-6 text-sm font-semibold",
              agree === true
                ? "bg-emerald-600 text-white hover:bg-emerald-700"
                : "border border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50",
            )}
            onClick={() => {
              setAgree(true);
              setSelected(new Set());
              setSelStage(null);
              const fallbackHealthy = t(
                `modalityDisagree.ffa.${FFA_HEALTHY_VALUE}` as never,
              );
              onChange(
                encodeModalityAiAlignedLabel(yesSnapshot || fallbackHealthy),
              );
            }}
          >
            {t("analysisCard.yesUpper")}
          </Button>
          <Button
            type="button"
            className={cn(
              "rounded-xl px-6 text-sm font-semibold",
              agree === false
                ? "bg-rose-600 text-white hover:bg-rose-700"
                : "border border-rose-300 bg-white text-rose-700 hover:bg-rose-50",
            )}
            onClick={() => {
              setAgree(false);
              setSelected(new Set());
              setSelStage(null);
              onChange(MODALITY_DISAGREE_PENDING);
            }}
          >
            {t("analysisCard.noUpper")}
          </Button>
        </div>
      </div>

      {agree === false && (
        <div className="space-y-3 rounded-2xl border border-rose-200 bg-rose-50/50 p-4">
          <span className="mb-1 block text-sm font-semibold uppercase tracking-[0.08em] text-rose-700">
            {t("analysisCard.correctionTitle")}
          </span>
          <p className="mb-2 text-[11px] leading-snug text-rose-900/80">
            {t("aiAnalysisPanel.modalityPickFfaCondition")}
          </p>

          <div className="space-y-2">
            {itemsForPicker.map((item) => {
              const greyOthers =
                selected.has(FFA_HEALTHY_VALUE) &&
                item.value !== FFA_HEALTHY_VALUE;
              const checked = selected.has(item.value);
              return (
                <label
                  key={item.value}
                  className={cn(
                    "flex cursor-pointer items-start gap-2 rounded-lg border border-rose-200/80 bg-white px-3 py-2 text-sm text-slate-900",
                    greyOthers && "cursor-not-allowed opacity-50",
                  )}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-400 text-cyan-600"
                    checked={checked}
                    disabled={greyOthers}
                    onChange={() => toggleCode(item.value)}
                  />
                  <span>{item.label}</span>
                </label>
              );
            })}
          </div>

          {drNeeded ? (
            <div className="border-t border-rose-200/80 pt-3">
              <p className="mb-2 text-[11px] font-medium text-slate-700">
                {t("modalityDisagree.ffaDrStageTitle")}
              </p>
              <p className="mb-2 text-[10px] leading-snug text-slate-600">
                {t("modalityDisagree.ffaDrStageHint")}
              </p>
              <select
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                value={selStage ?? ""}
                onChange={(e) => {
                  const raw = e.target.value.trim();
                  const nextStage = raw || null;
                  setSelStage(nextStage);
                  persistDiagSelections(selected, nextStage);
                }}
              >
                <option value="">
                  {t("analysisCard.correctionPlaceholder")}
                </option>
                {DR_IDX.map((i) => {
                  const label =
                    locale === "tr"
                      ? DR_STAGE_LABELS_TR[i].trim()
                      : DR_STAGE_LABELS_EN[i].trim();
                  const stored = getStorageDrLabel(i, locale);
                  return (
                    <option key={i} value={stored.trim()}>
                      {label}
                    </option>
                  );
                })}
              </select>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
