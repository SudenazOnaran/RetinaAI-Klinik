"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/components/providers/i18n-provider";
import { getDrStageIndexFromLabel } from "@/lib/dr-stage-labels";
import {
  decodeOctMultiSelection,
  decodeModalityAiAlignedLabel,
  encodeOctMultiSelection,
  encodeModalityAiAlignedLabel,
  isDoctorApprovalToken,
  isModalityDisagreePending,
  MODALITY_DISAGREE_PENDING,
} from "@/lib/doctor-feedback";
import { cn } from "@/lib/utils";
import { OCT_HEALTHY_VALUE } from "@/lib/modality-risk-surface";

/** Fundus onayı ile aynı anlam; `octDrFeedback` / `ffaDrFeedback` için. */
export const MODALITY_DOCTOR_APPROVAL_VALUE = "ai_sonucu_dogru";

export type ModalityAiPickItem = {
  /** `Analysis.oct|ffa` alanına yazılan (çoğunlukla `name` ile aynı) */
  value: string;
  /** Buton üzerinde (çoğunlukla aynı) */
  label: string;
  /** @deprecated Seçim artık dropdown; gösterilmez */
  likelihoodBadge?: string;
};

type ModalityConditionFeedbackProps = {
  value: string;
  onChange: (value: string) => void;
  items: ModalityAiPickItem[];
  /** Geriye dönük uyumluluk; düzeltme artık dropdown ile fundus formatında */
  disagreePrompt: string;
  /** `items` boşken Hayır açıklaması */
  noItemsHint: string;
  /**
   * true: AI listesi boş olsa bile «Hayır» tıklanabilir (sabit OCT/FFA listesi gibi).
   */
  allowDisagreeWhenEmpty?: boolean;
  /** «Evet» ile saklanacak düz metin (AI’nın öne çıkan tanısı / sağlıklı özeti). */
  approvalAiSummaryLabel?: string;
  className?: string;
};

export function ModalityConditionFeedback({
  value,
  onChange,
  items,
  disagreePrompt: _disagreePrompt,
  noItemsHint,
  allowDisagreeWhenEmpty = false,
  approvalAiSummaryLabel,
  className,
}: ModalityConditionFeedbackProps) {
  void _disagreePrompt;
  const { t } = useTranslation();
  const [agree, setAgree] = useState<boolean | null>(() =>
    initAgreeFromValue(value),
  );

  useEffect(() => {
    setAgree(initAgreeFromValue(value));
  }, [value]);

  const selected = value.trim();
  const canDisagree = allowDisagreeWhenEmpty || items.length > 0;
  const [selectedSet, setSelectedSet] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!selected || isModalityDisagreePending(selected)) {
      setSelectedSet(new Set());
      return;
    }
    const decoded = decodeOctMultiSelection(selected);
    if (decoded.length > 0) {
      setSelectedSet(new Set(decoded));
      return;
    }
    const hit = items.some((i) => i.value.trim() === selected);
    setSelectedSet(hit ? new Set([selected]) : new Set());
  }, [selected, items]);

  const persistSelection = (next: Set<string>) => {
    if (next.size === 0) {
      onChange(MODALITY_DISAGREE_PENDING);
      return;
    }
    onChange(encodeOctMultiSelection([...next]));
  };

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
              const snapshot = approvalAiSummaryLabel?.trim();
              onChange(
                snapshot
                  ? encodeModalityAiAlignedLabel(snapshot)
                  : MODALITY_DOCTOR_APPROVAL_VALUE,
              );
            }}
          >
            {t("analysisCard.yesUpper")}
          </Button>
          <Button
            type="button"
            disabled={!canDisagree}
            title={!canDisagree ? noItemsHint : undefined}
            className={cn(
              "rounded-xl px-6 text-sm font-semibold",
              agree === false
                ? "bg-rose-600 text-white hover:bg-rose-700"
                : "border border-rose-300 bg-white text-rose-700 hover:bg-rose-50",
            )}
            onClick={() => {
              if (!canDisagree) return;
              setAgree(false);
              onChange(MODALITY_DISAGREE_PENDING);
            }}
          >
            {t("analysisCard.noUpper")}
          </Button>
        </div>
      </div>

      {!canDisagree ? (
        <p className="text-[11px] leading-snug text-amber-800">{noItemsHint}</p>
      ) : null}

      {agree === false && canDisagree && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-4">
          <span className="mb-3 block text-sm font-semibold uppercase tracking-[0.08em] text-rose-700">
            {t("analysisCard.correctionTitle")}
          </span>
          <div className="space-y-2">
            {items.map((item, idx) => {
              const valueKey = item.value.trim();
              const checked = selectedSet.has(valueKey);
              const healthySelected = selectedSet.has(OCT_HEALTHY_VALUE);
              const disabled = healthySelected && valueKey !== OCT_HEALTHY_VALUE;
              return (
                <label
                  key={`${item.value}::${idx}`}
                  className={cn(
                    "flex cursor-pointer items-start gap-2 rounded-lg border border-rose-200/80 bg-white px-3 py-2 text-sm text-slate-900",
                    disabled && "cursor-not-allowed opacity-50",
                  )}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-400 text-cyan-600"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => {
                      const next = new Set(selectedSet);
                      if (valueKey === OCT_HEALTHY_VALUE) {
                        if (checked) next.delete(valueKey);
                        else {
                          next.clear();
                          next.add(valueKey);
                        }
                      } else {
                        next.delete(OCT_HEALTHY_VALUE);
                        if (checked) next.delete(valueKey);
                        else next.add(valueKey);
                      }
                      setSelectedSet(next);
                      persistSelection(next);
                    }}
                  />
                  <span>{item.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function initAgreeFromValue(v: string): boolean | null {
  const t = v.trim();
  if (!t) return null;
  if (isModalityDisagreePending(t)) return false;
  if (decodeModalityAiAlignedLabel(t)) return true;
  if (isDoctorApprovalToken(t)) return true;
  if (getDrStageIndexFromLabel(t) !== null) return false;
  if (t.startsWith("ffa_json:")) return false;
  if (t.startsWith("oct_")) return false;
  return false;
}
