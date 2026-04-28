"use client";

import { useCallback, useState } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { saveAnalysisAction } from "@/app/actions/save-analysis";
import { isStaleServerActionError } from "@/lib/server-action-client";
import { type AiAnalysisDraft } from "@/components/dashboard/image-analysis-card";
import { AiAnalysisPanel } from "@/components/dashboard/ai-analysis-panel";
import { ClipboardPlus, Microscope } from "lucide-react";
import { useTranslation } from "@/components/providers/i18n-provider";
import {
  DR_STAGE_LABELS_EN,
  DR_STAGE_LABELS_TR,
  formatDrLabelForDisplay,
  resolveDrLabelToStoredForm,
} from "@/lib/dr-stage-labels";
import { REPORT_SECTION_MAX_LEN } from "@/lib/dataset/analysis-report-sections";
import { modalityDrFeedbackForStorage } from "@/lib/doctor-feedback";

export type ManualReportCardMode = "clinical" | "radiological";

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
  /** clinical: yalnızca metin formu; radiological: Fundus/OCT/FFA AI paneli */
  mode?: ManualReportCardMode;
};

const MAX_FIELD_LENGTH = REPORT_SECTION_MAX_LEN;

export function ManualReportCard({
  patientId,
  patientInfo,
  doctorName,
  mode = "clinical",
}: ManualReportCardProps) {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [aiDraft, setAiDraft] = useState<AiAnalysisDraft | null>(null);
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
  const [octImageDataUrl, setOctImageDataUrl] = useState<string | null>(null);
  const [ffaImageDataUrl, setFfaImageDataUrl] = useState<string | null>(null);
  const [modalityPanelKey, setModalityPanelKey] = useState(0);
  const [octDoctorFeedback, setOctDoctorFeedback] = useState("");
  const [ffaDoctorFeedback, setFfaDoctorFeedback] = useState("");
  const [modalityAppendixOct, setModalityAppendixOct] = useState("");
  const [modalityAppendixFfa, setModalityAppendixFfa] = useState("");

  const appendOctToReport = useCallback(
    (text: string) => {
      setModalityAppendixOct((prev) => {
        const next = prev.trim() ? `${prev.trim()}\n\n━━━\n\n${text}` : text;
        if (next.length > REPORT_SECTION_MAX_LEN) {
          toast({
            variant: "destructive",
            title: t("aiAnalysisPanel.appendLimitTitle"),
            description: t("aiAnalysisPanel.appendModalityDesc", {
              max: REPORT_SECTION_MAX_LEN,
            }),
          });
          return prev;
        }
        return next;
      });
    },
    [toast, t],
  );

  const appendFfaToReport = useCallback(
    (text: string) => {
      setModalityAppendixFfa((prev) => {
        const next = prev.trim() ? `${prev.trim()}\n\n━━━\n\n${text}` : text;
        if (next.length > REPORT_SECTION_MAX_LEN) {
          toast({
            variant: "destructive",
            title: t("aiAnalysisPanel.appendLimitTitle"),
            description: t("aiAnalysisPanel.appendModalityDesc", {
              max: REPORT_SECTION_MAX_LEN,
            }),
          });
          return prev;
        }
        return next;
      });
    },
    [toast, t],
  );

  const handleSave = async () => {
    setBusy(true);
    try {
      if (mode === "radiological") {
        const hasAnyModality =
          Boolean(aiDraft?.originalImage?.trim()) ||
          Boolean(octImageDataUrl) ||
          Boolean(ffaImageDataUrl);
        if (!hasAnyModality) {
          toast({
            variant: "destructive",
            title: t("radiologicalReport.validationTitle"),
            description: t("radiologicalReport.validationBody"),
            duration: 7000,
          });
          setBusy(false);
          return;
        }
      }

      const exceededField = [
        { label: t("manualReport.anamnesis"), value: anamnesis },
        { label: t("manualReport.examFindings"), value: examFindings },
        { label: t("manualReport.labResults"), value: labResults },
        {
          label: t("manualReport.clinicalAssessment"),
          value: clinicalAssessment,
        },
        {
          label: t("manualReport.treatment"),
          value: treatmentRecommendations,
        },
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
      const correctionLabelSources =
        aiDraft?.correctionLabels != null && aiDraft.correctionLabels.length > 0
          ? aiDraft.correctionLabels
          : aiDraft?.correctionLabel != null &&
              String(aiDraft.correctionLabel).trim() !== ""
            ? [String(aiDraft.correctionLabel).trim()]
            : [];
      const resolvedCorrection =
        correctionLabelSources.length > 0
          ? correctionLabelSources
              .map((lbl) =>
                resolveDrLabelToStoredForm(String(lbl).trim(), locale),
              )
              .filter(Boolean)
              .join("\n")
          : null;
      const finalConfidence =
        typeof aiDraft?.confidence === "number" ? aiDraft.confidence : 0;

      const aiIncludedRadiological =
        Boolean(aiDraft) || Boolean(octImageDataUrl || ffaImageDataUrl);

      let aiSummary =
        mode === "clinical"
          ? t("manualReport.aiNotIncluded")
          : aiDraft
            ? [
                `${t("manualReport.aiResult")}: ${formatDrLabelForDisplay(aiDraft.aiResult, locale)}`,
                `${t("manualReport.aiConfidence")}: %${Math.round((aiDraft.confidence || 0) * 100)}`,
                `${t("manualReport.aiCorrection")}: ${correctionLabelSources.length > 0 ? correctionLabelSources.map((lbl) => formatDrLabelForDisplay(String(lbl).trim(), locale)).join(" · ") : t("manualReport.none")}`,
                ...(aiDraft.analysisNotes?.trim()
                  ? [
                      `${t("radiologicalReport.analysisNotesSummaryTag")}: ${aiDraft.analysisNotes.trim()}`,
                    ]
                  : []),
              ].join(" | ")
            : [
                t("radiologicalReport.summaryFundusSkipped"),
                octImageDataUrl ? t("radiologicalReport.summaryOctYes") : "",
                ffaImageDataUrl ? t("radiologicalReport.summaryFfaYes") : "",
              ]
                .filter(Boolean)
                .join(" | ");

      const reportKind =
        mode === "clinical"
          ? ("clinical_manual" as const)
          : ("radiological_ai" as const);

      const reportTitleResolved =
        mode === "radiological"
          ? t("radiologicalReport.defaultTitle")
          : reportTitle.trim() || t("manualReport.defaultTitle");
      const reportSectionsPayload =
        mode === "radiological"
          ? {
              reportTitle: reportTitleResolved,
              reportDate: reportDate || "-",
              doctorDisplayName: doctorName || t("manualReport.notSpecified"),
              anamnesis: "-",
              examFindings: "-",
              labResults: "-",
              clinicalAssessment: "-",
              treatmentRecommendations: "-",
              doctorNotes: "-",
            }
          : {
              reportTitle: reportTitleResolved,
              reportDate: reportDate || "-",
              doctorDisplayName: doctorName || t("manualReport.notSpecified"),
              anamnesis: anamnesis.trim() || "-",
              examFindings: examFindings.trim() || "-",
              labResults: labResults.trim() || "-",
              clinicalAssessment: clinicalAssessment.trim() || "-",
              treatmentRecommendations: treatmentRecommendations.trim() || "-",
              doctorNotes: doctorNotes.trim() || "-",
            };

      const saveResult = await saveAnalysisAction({
        patientId,
        aiResult: aiResultForDb,
        confidence: finalConfidence,
        heatmapUrl: mode === "radiological" ? aiDraft?.heatmapUrl : undefined,
        originalImage:
          mode === "radiological" ? aiDraft?.originalImage : undefined,
        octImage:
          mode === "radiological" ? (octImageDataUrl ?? undefined) : undefined,
        ffaImage:
          mode === "radiological" ? (ffaImageDataUrl ?? undefined) : undefined,
        aiOdriLabels:
          mode === "radiological" ? aiDraft?.aiOdriLabels : undefined,
        aiOdriConfidences:
          mode === "radiological" ? aiDraft?.aiOdriConfidences : undefined,
        reportSections: reportSectionsPayload,
        reportMeta: {
          reportKind,
          aiIncluded: mode === "clinical" ? false : aiIncludedRadiological,
          patientInfo: {
            fullName: patientInfo.fullName,
            tcNo: patientInfo.tcNo,
            age: patientInfo.age ?? null,
            gender: patientInfo.gender ?? null,
          },
          aiSummary,
          modalityAppendixOct: modalityAppendixOct.trim(),
          modalityAppendixFfa: modalityAppendixFfa.trim(),
        },
        ilaclar:
          mode === "radiological" ? "-" : treatmentRecommendations.trim(),
        drFeedback: resolvedCorrection ?? undefined,
        octDrFeedback:
          mode === "radiological"
            ? modalityDrFeedbackForStorage(octDoctorFeedback)
            : undefined,
        ffaDrFeedback:
          mode === "radiological"
            ? modalityDrFeedbackForStorage(ffaDoctorFeedback)
            : undefined,
        aiInferenceSnapshot:
          mode === "radiological"
            ? (aiDraft?.aiInferenceSnapshot ?? undefined)
            : undefined,
      });

      if (!saveResult?.ok) {
        throw new Error(saveResult?.error || t("manualReport.toastSaveFail"));
      }

      toast({
        title: t("manualReport.toastSavedTitle"),
        description:
          mode === "radiological"
            ? t("radiologicalReport.toastSavedDesc")
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
      setOctImageDataUrl(null);
      setFfaImageDataUrl(null);
      setModalityPanelKey((k) => k + 1);
      setOctDoctorFeedback("");
      setFfaDoctorFeedback("");
      setModalityAppendixOct("");
      setModalityAppendixFfa("");
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

  if (mode === "radiological") {
    return (
      <Card className="min-w-0 w-full border border-[#d8e0df] bg-white shadow-sm">
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="flex items-center gap-2 text-slate-900">
            <Microscope className="h-5 w-5 text-[var(--retina-primary)]" />
            {t("radiologicalReport.panelTitle")}
          </CardTitle>
          <CardDescription className="space-y-2">
            <span>{t("radiologicalReport.panelDescription")}</span>
            <span className="block text-sm text-slate-600">
              {t("radiologicalReport.workflowBelowPanel")}
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <AiAnalysisPanel
            patientId={patientId}
            patientInfo={patientInfo}
            doctorName={doctorName}
            onFundusDraftChange={setAiDraft}
            onAppendOctToReport={appendOctToReport}
            onAppendFfaToReport={appendFfaToReport}
            onOctReportImageChange={setOctImageDataUrl}
            onFfaReportImageChange={setFfaImageDataUrl}
            modalityRemountKey={modalityPanelKey}
            octDoctorFeedback={octDoctorFeedback}
            onOctDoctorFeedbackChange={setOctDoctorFeedback}
            ffaDoctorFeedback={ffaDoctorFeedback}
            onFfaDoctorFeedbackChange={setFfaDoctorFeedback}
          />
          <div className="flex justify-end border-t border-slate-100 pt-4">
            <Button
              onClick={handleSave}
              disabled={busy}
              className="min-w-[200px] rounded-lg bg-[var(--retina-primary)] px-5 text-white shadow-sm transition-all duration-200 hover:bg-[var(--retina-primary-deep)] hover:shadow-md"
            >
              {busy
                ? t("manualReport.saving")
                : t("radiologicalReport.saveButton")}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:items-start">
      <Card className="min-w-0 w-full border border-[#d8e0df] bg-white shadow-sm">
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="flex items-center gap-2 text-slate-900">
            <ClipboardPlus className="h-5 w-5 text-[var(--retina-primary)]" />
            {t("manualReport.editorTitle")}
          </CardTitle>
          <CardDescription>
            {t("manualReport.editorDescriptionClinical")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
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

          <label className="block space-y-1 text-sm text-slate-700">
            <span>{t("manualReport.anamnesis")}</span>
            <Textarea
              value={anamnesis}
              onChange={(e) => setAnamnesis(e.target.value)}
              placeholder={t("manualReport.anamnesisPlaceholder")}
              rows={3}
              maxLength={MAX_FIELD_LENGTH}
            />
          </label>

          <label className="block space-y-1 text-sm text-slate-700">
            <span>{t("manualReport.examFindings")}</span>

            <Textarea
              value={examFindings}
              onChange={(e) => setExamFindings(e.target.value)}
              placeholder={t("manualReport.examFindingsPlaceholder")}
              rows={4}
              maxLength={MAX_FIELD_LENGTH}
              className="leading-relaxed"
            />
          </label>

          <label className="block space-y-1 text-sm text-slate-700">
            <span>{t("manualReport.labResults")}</span>
            <Textarea
              value={labResults}
              onChange={(e) => setLabResults(e.target.value)}
              placeholder={t("manualReport.labResultsPlaceholder")}
              rows={3}
              maxLength={MAX_FIELD_LENGTH}
            />
          </label>

          <label className="block space-y-1 text-sm text-slate-700">
            <span>{t("manualReport.clinicalAssessment")}</span>
            <Textarea
              value={clinicalAssessment}
              onChange={(e) => setClinicalAssessment(e.target.value)}
              placeholder={t("manualReport.clinicalAssessmentPlaceholder")}
              rows={4}
              maxLength={MAX_FIELD_LENGTH}
            />
          </label>

          <label className="block space-y-1 text-sm text-slate-700">
            <span>{t("manualReport.treatment")}</span>
            <Textarea
              value={treatmentRecommendations}
              onChange={(e) => setTreatmentRecommendations(e.target.value)}
              placeholder={t("manualReport.treatmentPlaceholder")}
              rows={4}
              maxLength={MAX_FIELD_LENGTH}
            />
          </label>

          <label className="block space-y-1 text-sm text-slate-700">
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
              {busy ? t("manualReport.saving") : t("manualReport.save")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
