"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { saveAnalysisAction } from "@/app/actions/save-analysis";
import { isStaleServerActionError } from "@/lib/server-action-client";
import {
  type AiAnalysisDraft,
  ImageAnalysisCard,
} from "@/components/dashboard/image-analysis-card";
import { ChevronDown, ClipboardPlus, Sparkles, X } from "lucide-react";
import { useTranslation } from "@/components/providers/i18n-provider";
import {
  DR_STAGE_LABELS_EN,
  DR_STAGE_LABELS_TR,
  formatDrLabelForDisplay,
  resolveDrLabelToStoredForm,
} from "@/lib/dr-stage-labels";

type ManualReportCardProps = {
  patientId: string;
  patientInfo: {
    fullName: string;
    tcNo: string;
    age?: number | null;
    gender?: string | null;
    risk?: string | null;
  };
  doctorName?: string;
};

const MAX_FIELD_LENGTH = 1500;

export function ManualReportCard({
  patientId,
  patientInfo,
  doctorName,
}: ManualReportCardProps) {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [aiDraft, setAiDraft] = useState<AiAnalysisDraft | null>(null);
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [reportTitle, setReportTitle] = useState("");
  const [anamnesis, setAnamnesis] = useState("");
  const [examFindings, setExamFindings] = useState("");
  const [labResults, setLabResults] = useState("");
  const [clinicalAssessment, setClinicalAssessment] = useState("");
  const [treatmentRecommendations, setTreatmentRecommendations] = useState("");
  const [doctorNotes, setDoctorNotes] = useState("");
  const [reportDate, setReportDate] = useState(
    new Date().toISOString().slice(0, 10),
  );

  const handleSave = async () => {
    setBusy(true);
    try {
      const exceededField = [
        { label: t("manualReport.anamnesis"), value: anamnesis },
        { label: t("manualReport.examFindings"), value: examFindings },
        { label: t("manualReport.labResults"), value: labResults },
        { label: t("manualReport.clinicalAssessment"), value: clinicalAssessment },
        { label: t("manualReport.treatment"), value: treatmentRecommendations },
        { label: t("manualReport.doctorNotes"), value: doctorNotes },
      ].find((field) => field.value.length > MAX_FIELD_LENGTH);

      if (exceededField) {
        throw new Error(
          `${exceededField.label} alanında maksimum karakter sınırı aşıldı (${exceededField.value.length}/${MAX_FIELD_LENGTH}).`,
        );
      }

      const defaultEvre0 =
        locale === "tr" ? DR_STAGE_LABELS_TR[0] : DR_STAGE_LABELS_EN[0];
      const riskForSave =
        resolveDrLabelToStoredForm(patientInfo.risk, locale) ?? defaultEvre0;
      const resolvedAiOnly =
        aiDraft?.aiResult != null && String(aiDraft.aiResult).trim() !== ""
          ? resolveDrLabelToStoredForm(aiDraft.aiResult, locale)
          : null;
      const aiResultForDb = resolvedAiOnly ?? riskForSave;
      const resolvedCorrection =
        aiDraft?.correctionLabel != null &&
        String(aiDraft.correctionLabel).trim() !== ""
          ? resolveDrLabelToStoredForm(aiDraft.correctionLabel, locale)
          : null;
      const finalConfidence =
        typeof aiDraft?.confidence === "number" ? aiDraft.confidence : 0;

      const aiSummary = aiDraft
        ? [
            `${t("manualReport.aiResult")}: ${formatDrLabelForDisplay(aiDraft.aiResult, locale)}`,
            `${t("manualReport.aiConfidence")}: %${Math.round((aiDraft.confidence || 0) * 100)}`,
            `${t("manualReport.aiCorrection")}: ${aiDraft.correctionLabel ? formatDrLabelForDisplay(aiDraft.correctionLabel, locale) : t("manualReport.none")}`,
          ].join(" | ")
        : t("manualReport.aiNotIncluded");

      const saveResult = await saveAnalysisAction({
        patientId,
        aiResult: aiResultForDb,
        confidence: finalConfidence,
        heatmapUrl: aiDraft?.heatmapUrl,
        originalImage: aiDraft?.originalImage,
        aiOdriLabels: aiDraft?.aiOdriLabels,
        aiOdriConfidences: aiDraft?.aiOdriConfidences,
        reportSections: {
          reportTitle: reportTitle.trim() || t("manualReport.defaultTitle"),
          reportDate: reportDate || "-",
          doctorDisplayName: doctorName || t("manualReport.notSpecified"),
          anamnesis: anamnesis.trim() || "-",
          examFindings: examFindings.trim() || "-",
          labResults: labResults.trim() || "-",
          clinicalAssessment: clinicalAssessment.trim() || "-",
          treatmentRecommendations: treatmentRecommendations.trim() || "-",
          doctorNotes: doctorNotes.trim() || "-",
        },
        reportMeta: {
          aiIncluded: Boolean(aiDraft),
          patientInfo: {
            fullName: patientInfo.fullName,
            tcNo: patientInfo.tcNo,
            age: patientInfo.age ?? null,
            gender: patientInfo.gender ?? null,
          },
          aiSummary,
        },
        ilaclar: treatmentRecommendations.trim(),
        drFeedback: resolvedCorrection ?? undefined,
        aiInferenceSnapshot: aiDraft?.aiInferenceSnapshot ?? undefined,
      });

      if (!saveResult?.ok) {
        throw new Error(saveResult?.error || t("manualReport.toastSaveFail"));
      }

      toast({
        title: t("manualReport.toastSavedTitle"),
        description: aiDraft
          ? t("manualReport.toastSavedWithAi")
          : t("manualReport.toastSavedNoAi"),
        duration: 4000,
      });

      setAnamnesis("");
      setExamFindings("");
      setLabResults("");
      setClinicalAssessment("");
      setTreatmentRecommendations("");
      setDoctorNotes("");
      setReportTitle("");
      setReportDate(new Date().toISOString().slice(0, 10));
      setAiDraft(null);
      router.refresh();
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : t("manualReport.toastSaveFail");
      const stale = isStaleServerActionError(errorMessage);
      toast({
        variant: "destructive",
        title: stale
          ? t("manualReport.staleServerActionTitle")
          : t("manualReport.saveErrorTitle"),
        description: stale
          ? t("manualReport.staleServerActionHint")
          : errorMessage,
        duration: stale ? 12_000 : 8_000,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="border border-[#d8e0df] bg-white shadow-sm">
      <CardHeader className="border-b border-slate-100">
        <CardTitle className="flex items-center gap-2 text-slate-900">
          <ClipboardPlus className="h-5 w-5 text-[var(--retina-primary)]" />
          {t("manualReport.title")}
        </CardTitle>
        <CardDescription>{t("manualReport.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {aiDraft ? (
          <div className="flex items-start justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            <div>
              <p className="flex items-center gap-2 font-medium">
                <Sparkles className="h-4 w-4" />{" "}
                {t("manualReport.aiWillInclude")}
              </p>
              <p className="mt-1 text-xs text-emerald-800">
                {t("manualReport.resultPrefix")}{" "}
                {aiDraft.correctionLabel || aiDraft.aiResult} |{" "}
                {t("manualReport.confidencePrefix")} %
                {Math.round((aiDraft.confidence || 0) * 100)}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-emerald-900 hover:bg-emerald-100"
              onClick={() => setAiDraft(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            {t("manualReport.aiOptionalHint")}
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm text-slate-700 md:col-span-2">
            <span>{t("manualReport.reportTitle")}</span>
            <Input
              value={reportTitle}
              onChange={(e) => setReportTitle(e.target.value)}
              placeholder={t("manualReport.reportTitlePlaceholder")}
            />
          </label>

          <label className="space-y-1 text-sm text-slate-700">
            <span>{t("manualReport.patientIdentity")}</span>
            <Input
              value={`${patientInfo.fullName} | T.C: ${patientInfo.tcNo}`}
              disabled
            />
          </label>

          <label className="space-y-1 text-sm text-slate-700">
            <span>{t("manualReport.reportDate")}</span>
            <Input
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
            />
          </label>

          <label className="space-y-1 text-sm text-slate-700">
            <span>{t("manualReport.doctorInfo")}</span>
            <Input
              value={doctorName || t("manualReport.notSpecified")}
              disabled
            />
          </label>
        </div>

        <label className="space-y-1 text-sm text-slate-700 block">
          <span>{t("manualReport.anamnesis")}</span>
          <Textarea
            value={anamnesis}
            onChange={(e) => setAnamnesis(e.target.value)}
            placeholder={t("manualReport.anamnesisPlaceholder")}
            rows={3}
            maxLength={MAX_FIELD_LENGTH}
          />
        </label>

        <label className="space-y-1 text-sm text-slate-700 block">
          <span>{t("manualReport.examFindings")}</span>
          <Textarea
            value={examFindings}
            onChange={(e) => setExamFindings(e.target.value)}
            placeholder={t("manualReport.examFindingsPlaceholder")}
            rows={3}
            maxLength={MAX_FIELD_LENGTH}
          />
        </label>

        <label className="space-y-1 text-sm text-slate-700 block">
          <span>{t("manualReport.labResults")}</span>
          <Textarea
            value={labResults}
            onChange={(e) => setLabResults(e.target.value)}
            placeholder={t("manualReport.labResultsPlaceholder")}
            rows={3}
            maxLength={MAX_FIELD_LENGTH}
          />
        </label>

        <label className="space-y-1 text-sm text-slate-700 block">
          <span>{t("manualReport.clinicalAssessment")}</span>
          <Textarea
            value={clinicalAssessment}
            onChange={(e) => setClinicalAssessment(e.target.value)}
            placeholder={t("manualReport.clinicalAssessmentPlaceholder")}
            rows={4}
            maxLength={MAX_FIELD_LENGTH}
          />
        </label>

        <label className="space-y-1 text-sm text-slate-700 block">
          <span>{t("manualReport.treatment")}</span>
          <Textarea
            value={treatmentRecommendations}
            onChange={(e) => setTreatmentRecommendations(e.target.value)}
            placeholder={t("manualReport.treatmentPlaceholder")}
            rows={4}
            maxLength={MAX_FIELD_LENGTH}
          />
        </label>

        <Collapsible
          open={isAiOpen}
          onOpenChange={setIsAiOpen}
          className="rounded-xl border border-slate-200 bg-slate-50"
        >
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              className="flex w-full items-center justify-between rounded-none px-4 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              <span>{t("manualReport.aiOptional")}</span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${isAiOpen ? "rotate-180" : ""}`}
              />
            </Button>
          </CollapsibleTrigger>

          <CollapsibleContent
            forceMount
            className="space-y-2 border-t border-slate-200 p-3 data-[state=closed]:hidden"
          >
            <ImageAnalysisCard
              compact
              patientId={patientId}
              onAnalysisSuccess={() => setIsAiOpen(true)}
              onDraftChange={setAiDraft}
              patientInfo={{
                fullName: patientInfo.fullName,
                tcNo: patientInfo.tcNo,
                age: patientInfo.age ?? undefined,
              }}
              doctorName={doctorName}
            />
          </CollapsibleContent>
        </Collapsible>

        <label className="space-y-1 text-sm text-slate-700 block">
          <span>{t("manualReport.doctorNotes")}</span>
          <Textarea
            value={doctorNotes}
            onChange={(e) => setDoctorNotes(e.target.value)}
            placeholder={t("manualReport.doctorNotesPlaceholder")}
            rows={4}
            maxLength={MAX_FIELD_LENGTH}
          />
        </label>

        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={busy}
            className="min-w-[200px] rounded-lg bg-[var(--retina-primary)] px-5 text-white shadow-sm transition-all duration-200 hover:bg-[var(--retina-primary-deep)] hover:shadow-md"
          >
            {busy
              ? t("manualReport.saving")
              : aiDraft
                ? t("manualReport.saveWithAi")
                : t("manualReport.save")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
