"use client";

import {
  ImageAnalysisCard,
  type AiAnalysisDraft,
} from "@/components/dashboard/image-analysis-card";
import { MacularOctAnalysisCard } from "@/components/dashboard/macular-oct-analysis-card";
import { FfaAnalysisCard } from "@/components/dashboard/ffa-analysis-card";
import { useTranslation } from "@/components/providers/i18n-provider";

type AiAnalysisPanelProps = {
  patientId: string;
  patientInfo: {
    fullName: string;
    tcNo: string;
    age?: number | null;
  };
  doctorName?: string;
  onFundusDraftChange: (draft: AiAnalysisDraft | null) => void;
  onAppendExamFindings: (text: string) => void;
};

export function AiAnalysisPanel({
  patientId,
  patientInfo,
  doctorName,
  onFundusDraftChange,
  onAppendExamFindings,
}: AiAnalysisPanelProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-bold tracking-tight text-slate-900">
          {t("aiAnalysisPanel.title")}
        </h2>
        <p className="mt-0.5 text-xs text-slate-600">
          {t("aiAnalysisPanel.subtitle")}
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white shadow-sm">
        <div className="border-b border-slate-200 bg-[#f8f9fc] px-3 py-2">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-700">
            {t("aiAnalysisPanel.fundusShort")}
          </p>
          <p className="text-[11px] text-slate-500">
            {t("aiAnalysisPanel.fundusHint")}
          </p>
        </div>
        <ImageAnalysisCard
          suppressHeader
          compact
          className="rounded-none border-0 shadow-none"
          patientId={patientId}
          onDraftChange={onFundusDraftChange}
          patientInfo={{
            fullName: patientInfo.fullName,
            tcNo: patientInfo.tcNo,
            age: patientInfo.age ?? undefined,
          }}
          doctorName={doctorName}
        />
      </div>

      <MacularOctAnalysisCard
        patientId={patientId}
        variant="panel"
        onAppendToReport={onAppendExamFindings}
      />

      <FfaAnalysisCard
        patientId={patientId}
        variant="panel"
        onAppendToReport={onAppendExamFindings}
      />
    </div>
  );
}
