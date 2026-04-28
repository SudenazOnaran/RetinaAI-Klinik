"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/components/providers/i18n-provider";
import { getDrStageIndexFromLabel } from "@/lib/dr-stage-labels";
import {
  decodeModalityAiAlignedLabel,
  encodeModalityAiAlignedLabel,
  isDoctorApprovalToken,
  isModalityDisagreePending,
  MODALITY_DISAGREE_PENDING,
} from "@/lib/doctor-feedback";
import { cn } from "@/lib/utils";

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

  const selectValue = useMemo(() => {
    if (!selected || isModalityDisagreePending(selected)) return "";
    const hit = items.some((i) => i.value.trim() === selected);
    return hit ? selected : "";
  }, [selected, items]);

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
          <select
            className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
            value={selectValue}
            onChange={(e) => {
              const v = e.target.value.trim();
              if (!v) {
                onChange(MODALITY_DISAGREE_PENDING);
                return;
              }
              onChange(v);
            }}
          >
            <option value="">{t("analysisCard.correctionPlaceholder")}</option>
            {items.map((item, idx) => (
              <option key={`${item.value}::${idx}`} value={item.value.trim()}>
                {item.label}
              </option>
            ))}
          </select>
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
