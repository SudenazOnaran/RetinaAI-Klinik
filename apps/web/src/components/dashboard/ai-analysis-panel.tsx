"use client";

import {
  ImageAnalysisCard,
  type AiAnalysisDraft,
} from "@/components/dashboard/image-analysis-card";
import { MacularOctAnalysisCard } from "@/components/dashboard/macular-oct-analysis-card";
import { FfaAnalysisCard } from "@/components/dashboard/ffa-analysis-card";
import { useTranslation } from "@/components/providers/i18n-provider";
import { ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
type AiAnalysisPanelProps = {
  patientId: string;
  patientInfo: {
    fullName: string;
    tcNo: string;
    age?: number | null;
  };
  doctorName?: string;
  onFundusDraftChange: (draft: AiAnalysisDraft | null) => void;
  /** If omitted, OCT/FFA cards hide “add to report” actions. */
  onAppendOctToReport?: (text: string) => void;
  onAppendFfaToReport?: (text: string) => void;
  /** Seçilen OCT/FFA dosyasının data URL’i — rapor kaydında PDF ile saklanır. */
  onOctReportImageChange?: (dataUrl: string | null) => void;
  onFfaReportImageChange?: (dataUrl: string | null) => void;
  /** Kayıt sonrası OCT/FFA kartlarını sıfırlamak için artırın. */
  modalityRemountKey?: number;
  octDoctorFeedback?: string;
  onOctDoctorFeedbackChange?: (value: string) => void;
  ffaDoctorFeedback?: string;
  onFfaDoctorFeedbackChange?: (value: string) => void;
};

export function AiAnalysisPanel({
  patientId,
  patientInfo,
  doctorName,
  onFundusDraftChange,
  onAppendOctToReport,
  onAppendFfaToReport,
  onOctReportImageChange,
  onFfaReportImageChange,
  modalityRemountKey = 0,
  octDoctorFeedback,
  onOctDoctorFeedbackChange,
  ffaDoctorFeedback,
  onFfaDoctorFeedbackChange,
}: AiAnalysisPanelProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-3">
      <Collapsible defaultOpen className="group/fundus">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white shadow-sm">
          <CollapsibleTrigger
            type="button"
            className="flex w-full items-center justify-between gap-2 border-b border-slate-200 bg-[#f8f9fc] px-3 py-2 text-left transition-colors hover:bg-[#f0f3fa]"
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-700">
                {t("aiAnalysisPanel.fundusShort")} —{" "}
                <span className="font-normal normal-case text-slate-500">
                  {t("aiAnalysisPanel.modalityPanelToggle")}
                </span>
              </p>
              <p className="text-[11px] text-slate-500">
                {t("aiAnalysisPanel.fundusHint")}
              </p>
            </div>
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-data-[state=open]/fundus:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent>
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
          </CollapsibleContent>
        </div>
      </Collapsible>

      <Collapsible defaultOpen className="group/octpanel">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white shadow-sm">
          <CollapsibleTrigger
            type="button"
            className="flex w-full items-center justify-between gap-2 border-b border-slate-200 bg-[#f8f9fc] px-3 py-2 text-left transition-colors hover:bg-[#f0f3fa]"
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-700">
                {t("aiAnalysisPanel.octShort")} —{" "}
                <span className="font-normal normal-case text-slate-500">
                  {t("aiAnalysisPanel.modalityPanelToggle")}
                </span>
              </p>
              <p className="text-[11px] text-slate-500">
                {t("octAnalysis.title")}
              </p>
            </div>
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-data-[state=open]/octpanel:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <MacularOctAnalysisCard
              key={`oct-${modalityRemountKey}`}
              patientId={patientId}
              variant="panel"
              suppressHeader
              className="rounded-none border-0 shadow-none"
              onAppendToReport={onAppendOctToReport}
              onReportImageChange={onOctReportImageChange}
              reportDoctorFeedback={octDoctorFeedback}
              onReportDoctorFeedbackChange={onOctDoctorFeedbackChange}
            />
          </CollapsibleContent>
        </div>
      </Collapsible>

      <Collapsible defaultOpen className="group/ffapanel">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white shadow-sm">
          <CollapsibleTrigger
            type="button"
            className="flex w-full items-center justify-between gap-2 border-b border-slate-200 bg-[#f8f9fc] px-3 py-2 text-left transition-colors hover:bg-[#f0f3fa]"
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-700">
                {t("aiAnalysisPanel.ffaShort")} —{" "}
                <span className="font-normal normal-case text-slate-500">
                  {t("aiAnalysisPanel.modalityPanelToggle")}
                </span>
              </p>
              <p className="text-[11px] text-slate-500">
                {t("ffaAnalysis.title")}
              </p>
            </div>
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-data-[state=open]/ffapanel:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <FfaAnalysisCard
              key={`ffa-${modalityRemountKey}`}
              patientId={patientId}
              variant="panel"
              suppressHeader
              className="rounded-none border-0 shadow-none"
              onAppendToReport={onAppendFfaToReport}
              onReportImageChange={onFfaReportImageChange}
              reportDoctorFeedback={ffaDoctorFeedback}
              onReportDoctorFeedbackChange={onFfaDoctorFeedbackChange}
            />
          </CollapsibleContent>
        </div>
      </Collapsible>
    </div>
  );
}
