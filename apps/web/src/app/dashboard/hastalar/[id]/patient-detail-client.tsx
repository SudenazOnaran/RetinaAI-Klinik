"use client";

import {
  Suspense,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UpdatePatientDialog } from "@/components/dashboard/update-patient-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  previewRetinaReportPdf,
  previewRetinaReportPdfViaApi,
} from "@/lib/retina-report-pdf";
import { ManualReportCard } from "@/components/dashboard/manual-report-card";
import { RadiologicalReportsList } from "@/components/dashboard/radiological-reports-list";
import {
  formatDrLabelForDisplay,
  getDrStageIndexFromLabel,
  getStorageDrLabel,
} from "@/lib/dr-stage-labels";
import { isDoctorApprovalToken } from "@/lib/doctor-feedback";
import {
  clipReportListPreview,
  resolveExamAndModalityText,
} from "@/lib/report-display";
import { resolveClinicalFinalLabelForReport } from "@/lib/report-clinical-final-label";
import { useTranslation } from "@/components/providers/i18n-provider";
import {
  isClinicalReport,
  isRadiologicalAiWorkflowReport,
} from "@/lib/report-kind";

type PatientDetailTab =
  | "report-create"
  | "ai-analysis"
  | "reports"
  | "radiological-reports"
  | "progress";

/** Next.js 15: `useSearchParams` alt ağaçta kendi Suspense sınırında olmalı; aksi halde hasta sayfası istemcide çökebiliyor. */
function PatientDetailSearchParamsSync({
  setActiveTab,
}: {
  setActiveTab: Dispatch<SetStateAction<PatientDetailTab>>;
}) {
  const searchParams = useSearchParams();
  /** ReadonlySearchParams her render'da yeni referans verebilir; dependency'de kullanma (sonsuz setState döngüsü → error boundary). */
  const tabParam = searchParams.get("tab");
  useEffect(() => {
    if (tabParam === "reports") {
      setActiveTab("reports");
      return;
    }
    if (tabParam === "radiological-reports") {
      setActiveTab("radiological-reports");
      return;
    }
    if (tabParam === "ai-analysis") {
      setActiveTab("ai-analysis");
      return;
    }
    if (tabParam === "progression") {
      setActiveTab("progress");
      return;
    }
    setActiveTab("report-create");
  }, [tabParam, setActiveTab]);
  return null;
}

export default function PatientDetailClient({ patient }: { patient: any }) {
  const { t, locale } = useTranslation();
  const [activeTab, setActiveTab] = useState<PatientDetailTab>("report-create");
  const [editOpen, setEditOpen] = useState(false);

  const tabButtonClass = (tab: PatientDetailTab) =>
    [
      "rounded-lg border px-4 py-2 text-sm font-medium transition-all duration-200",
      "focus-visible:ring-2 focus-visible:ring-[var(--retina-primary)] focus-visible:ring-offset-2",
      activeTab === tab
        ? "border-[#5f56e8] bg-[#6c63ff] text-white shadow-sm hover:bg-[#5a52e0]"
        : "border-[#d6d2ff] bg-white text-[#4b45b5] hover:border-[#bcb5ff] hover:bg-[#f1efff] hover:text-[#3f399e]",
    ].join(" ");

  const getReportAccentClass = (index: number) => {
    const variants = [
      "border-l-[#659f92] bg-[#f7fbfa]",
      "border-l-[#8b6a49] bg-[#fdf9f4]",
      "border-l-[#5f90ad] bg-[#f7fafd]",
    ] as const;

    return variants[index % variants.length];
  };

  const reports = patient.analyses ?? [];
  const clinicalReports = reports.filter((r: any) => isClinicalReport(r));
  const radiologicalReports = reports.filter((r: any) =>
    isRadiologicalAiWorkflowReport(r),
  );

  const parseJsonArray = (value: string | null | undefined) => {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const parseStructuredReport = (value: string | null | undefined) => {
    if (!value) return null;
    try {
      const parsed = JSON.parse(value);
      if (parsed?.version === "manual_report_v2") {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  };

  const getLegacyFieldValue = (
    note: string | null | undefined,
    label: string,
  ) => {
    if (!note) return null;
    const prefix = `${label}:`;
    const line = note
      .split("\n")
      .map((v) => v.trim())
      .find((v) => v.startsWith(prefix));
    if (!line) return null;
    return line.slice(prefix.length).trim() || null;
  };

  const getReportSectionValue = (
    report: any,
    sectionKey:
      | "anamnesis"
      | "examFindings"
      | "labResults"
      | "clinicalAssessment"
      | "treatmentRecommendations",
    legacyLabel: string,
    fallback = "-",
  ) => {
    const dbColumn: Record<string, string> = {
      anamnesis: "sectionAnamnesis",
      examFindings: "sectionExamFindings",
      labResults: "sectionLabResults",
      clinicalAssessment: "sectionClinicalAssessment",
      treatmentRecommendations: "sectionTreatmentRecommendations",
    };
    const fromDb = report?.[dbColumn[sectionKey]];
    if (typeof fromDb === "string" && fromDb.trim()) {
      return fromDb;
    }

    const structured = parseStructuredReport(report?.doctorNote);
    const structuredValue = structured?.sections?.[sectionKey];
    if (typeof structuredValue === "string" && structuredValue.trim()) {
      return structuredValue;
    }

    const legacyValue = getLegacyFieldValue(report?.doctorNote, legacyLabel);
    if (legacyValue) return legacyValue;

    return fallback;
  };

  const getTreatmentText = (report: any) => {
    const sectionValue = getReportSectionValue(
      report,
      "treatmentRecommendations",
      "Tedavi ve Öneriler",
      "",
    );
    if (sectionValue) return sectionValue;
    return report?.ilaclar || "-";
  };

  const getDoctorFeedback = (report: any) => {
    const feedback = report?.drFeedback;

    if (Array.isArray(feedback)) {
      const firstValid = feedback.find((v) => v !== null && v !== "null");
      return firstValid ?? null;
    }

    if (typeof feedback === "string" && feedback !== "null") {
      return feedback;
    }

    return null;
  };

  const formatDiagnosisLabel = (label: string) =>
    formatDrLabelForDisplay(label, locale);

  const resolveEffectiveDiagnosis = (report: any) =>
    resolveClinicalFinalLabelForReport({
      originalImage: report?.originalImage,
      heatmapUrl: report?.heatmapUrl,
      aiResult: report?.aiResult,
      drFeedback: report?.drFeedback,
      doctorNote: report?.doctorNote,
      sectionClinicalAssessment: report?.sectionClinicalAssessment,
    });

  const resolveAiOnlyDiagnosis = (report: any) => {
    if (report?.aiResult) return report.aiResult;
    return getStorageDrLabel(0, locale);
  };

  const getSeverityScore = (label: string) => {
    return getDrStageIndexFromLabel(label) ?? 0;
  };

  const severityLabel = (score: number) => {
    if (score >= 4) return t("patientDetailProgress.severityProliferative");
    if (score === 3) return t("patientDetailProgress.severitySevere");
    if (score === 2) return t("patientDetailProgress.severityModerate");
    if (score === 1) return t("patientDetailProgress.severityMild");
    return t("patientDetailProgress.severityNone");
  };

  const orderedReports = [...reports].sort(
    (a: any, b: any) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  const progressionData = orderedReports.map(
    (r: any, index: number, arr: any[]) => {
      const aiResultLabel = formatDiagnosisLabel(r.aiResult || "-");
      const finalDiagnosisRaw = resolveEffectiveDiagnosis(r);
      const finalDiagnosisLabel = formatDiagnosisLabel(finalDiagnosisRaw);
      const score = getSeverityScore(finalDiagnosisRaw);
      const previousScore =
        index > 0
          ? getSeverityScore(resolveEffectiveDiagnosis(arr[index - 1]))
          : score;
      const delta = score - previousScore;

      return {
        id: r.id,
        date: new Date(r.createdAt),
        dateLabel: format(new Date(r.createdAt), "dd MMM yy", {
          locale: locale === "en" ? undefined : tr,
        }),
        aiResultLabel,
        finalDiagnosisRaw,
        finalDiagnosisLabel,
        stage: score,
        stageLabel: severityLabel(score),
        delta,
        trendType:
          delta < 0 ? "improvement" : delta > 0 ? "worsening" : "stable",
        trend:
          delta < 0
            ? t("patientDetailProgress.trendImprovement")
            : delta > 0
              ? t("patientDetailProgress.trendWorsening")
              : t("patientDetailProgress.trendStable"),
      };
    },
  );

  const netChange =
    progressionData.length >= 2
      ? progressionData[progressionData.length - 1].stage -
        progressionData[0].stage
      : 0;

  const netTrendLabel =
    netChange < 0
      ? t("patientDetailProgress.netImprovement")
      : netChange > 0
        ? t("patientDetailProgress.netWorsening")
        : t("patientDetailProgress.netStable");

  const handlePreviewReportPdf = async (
    report: any,
    pdfVariant: "clinical" | "radiological" = "clinical",
  ) => {
    const labels = parseJsonArray(report.aiOdriLabels);
    const confidences = parseJsonArray(report.aiOdriConfidences);
    const odirResults = labels.map((label: string, idx: number) => ({
      label,
      confidence: Number(confidences[idx] ?? 0),
    }));

    const structured = parseStructuredReport(report.doctorNote);
    const drFb = getDoctorFeedback(report);
    const pdfLocale = (locale === "en" ? "en" : "tr") as "tr" | "en";
    const payload = {
      patientId: patient.id,
      patientInfo: {
        fullName: patient.fullName,
        tcNo: patient.tcNo,
        age: patient.age,
      },
      doctorName: patient?.doctor?.name,
      reportDate: report.createdAt,
      aiResult: report.aiResult,
      confidence: Number(report.confidence ?? 0),
      odirResults,
      clinicalFinalResult: resolveEffectiveDiagnosis(report),
      doctorFeedback: drFb && !isDoctorApprovalToken(drFb) ? drFb : undefined,
      doctorNote: report.doctorNote,
      medications: getTreatmentText(report),
      originalImage: report.originalImage,
      heatmapUrl: report.heatmapUrl,
      octImageUrl: report.octImageUrl,
      ffaImageUrl: report.ffaImageUrl,
      reportTitle: report.reportTitle ?? structured?.reportTitle,
      reportDateLabel: report.reportDateKey ?? structured?.reportDate,
      reportDoctorDisplayName:
        report.reportDoctorDisplayName ?? structured?.doctorName,
      fundusModalityActive: Boolean(
        report?.originalImage?.trim() || report?.heatmapUrl?.trim(),
      ),
      sectionAnamnesis: report.sectionAnamnesis,
      sectionExamFindings: report.sectionExamFindings,
      sectionLabResults: report.sectionLabResults,
      sectionClinicalAssessment: report.sectionClinicalAssessment,
      sectionTreatmentRecommendations: report.sectionTreatmentRecommendations,
      sectionDoctorNotes: report.sectionDoctorNotes,
      pdfVariant,
      pdfLocale,
    };

    try {
      await fetch("/api/audit/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "DOWNLOAD",
          entityType: "REPORT",
          entityId: report.id,
          description: "Hasta detayindan PDF önizlendi",
          metadata: {
            patientId: patient.id,
            pdfMode: "preview",
          },
        }),
      });
    } catch {
      // Log hatasi PDF akisina engel olmasin.
    }

    try {
      await previewRetinaReportPdfViaApi({
        patientId: patient.id,
        reportId: report.id,
        pdfVariant,
        pdfLocale,
      });
      return;
    } catch (serverPdfErr) {
      console.warn("Sunucu PDF basarisiz, jsPDF kullaniliyor", serverPdfErr);
    }

    await previewRetinaReportPdf(payload);
  };

  return (
    <>
      <Suspense fallback={null}>
        <PatientDetailSearchParamsSync setActiveTab={setActiveTab} />
      </Suspense>
      <div className="space-y-6 p-4 md:p-6">
        <Card className="border border-[#d8e0df] bg-white shadow-sm">
          <CardContent className="flex flex-col justify-between gap-4 p-6 md:flex-row md:items-center">
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                {patient.fullName}
              </h1>
              <p className="text-sm text-slate-600">
                {t("patientDetail.tcPrefix")} {patient.tcNo} |{" "}
                {t("patientDetail.ageLabel")} {patient.age} |{" "}
                {t("patientDetail.diabetesDurationLabel")}{" "}
                {patient.diabetesYears ?? "-"} | HbA1c: {patient.hba1c ?? "-"}
              </p>
            </div>

            <Button
              className="h-11 rounded-xl bg-[var(--retina-primary)] px-5 text-white shadow-sm transition-all duration-200 hover:bg-[var(--retina-primary-deep)] hover:shadow-md"
              onClick={() => setEditOpen(true)}
            >
              {t("patientDetail.updateInfoButton")}
            </Button>
            <UpdatePatientDialog
              open={editOpen}
              onOpenChange={setEditOpen}
              patient={patient}
            />
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-4">
          <Button
            className={tabButtonClass("report-create")}
            variant="outline"
            onClick={() => setActiveTab("report-create")}
          >
            {t("patientDetail.tabCreateReport")}
          </Button>
          <Button
            className={tabButtonClass("ai-analysis")}
            variant="outline"
            onClick={() => setActiveTab("ai-analysis")}
          >
            {t("patientDetail.tabAiAnalysis")}
          </Button>
          <Button
            className={tabButtonClass("reports")}
            variant="outline"
            onClick={() => setActiveTab("reports")}
          >
            {t("patientDetail.tabPastReports")}
          </Button>
          <Button
            className={tabButtonClass("radiological-reports")}
            variant="outline"
            onClick={() => setActiveTab("radiological-reports")}
          >
            {t("patientDetail.tabRadiologicalReports")}
          </Button>
          <Button
            className={tabButtonClass("progress")}
            variant="outline"
            onClick={() => setActiveTab("progress")}
          >
            {t("patientDetail.tabDrProgression")}
          </Button>
        </div>

        {activeTab === "report-create" ? (
          <Card className="border border-[#d8e0df] bg-white shadow-sm">
            <CardContent className="space-y-4 p-4 md:p-5">
              <ManualReportCard
                mode="clinical"
                patientId={patient.id}
                patientInfo={{
                  fullName: patient.fullName,
                  tcNo: patient.tcNo,
                  age: patient.age,
                  gender: patient.gender,
                  risk: patient.risk,
                }}
                doctorName={patient?.doctor?.name}
              />
            </CardContent>
          </Card>
        ) : activeTab === "ai-analysis" ? (
          <Card className="border border-[#d8e0df] bg-white shadow-sm">
            <CardContent className="space-y-4 p-4 md:p-5">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                {t("patientDetail.aiAnalysisInfo")}
              </div>

              <ManualReportCard
                mode="radiological"
                patientId={patient.id}
                patientInfo={{
                  fullName: patient.fullName,
                  tcNo: patient.tcNo,
                  age: patient.age,
                  gender: patient.gender,
                  risk: patient.risk,
                }}
                doctorName={patient?.doctor?.name}
              />
            </CardContent>
          </Card>
        ) : activeTab === "reports" ? (
          <Card className="border border-[#d8e0df] bg-white shadow-sm">
            <CardHeader className="border-b border-slate-100 bg-[#f8faf9]">
              <CardTitle>{t("patientDetail.tabPastReports")}</CardTitle>
              <CardDescription>
                {t("patientDetailReports.foundRecords", {
                  count: clinicalReports.length,
                })}
              </CardDescription>
            </CardHeader>

            <CardContent className="min-w-0 space-y-4 overflow-x-hidden pt-4">
              {[...clinicalReports]
                .sort(
                  (a: any, b: any) =>
                    new Date(b.createdAt).getTime() -
                    new Date(a.createdAt).getTime(),
                )
                .map((r: any, idx: number) => {
                  const structuredR = parseStructuredReport(r.doctorNote);
                  const reportTitleLine =
                    (typeof r.reportTitle === "string" &&
                      r.reportTitle.trim()) ||
                    (typeof structuredR?.reportTitle === "string" &&
                      String(structuredR.reportTitle).trim()) ||
                    t("patientDetailReports.defaultReportTitle");
                  const reportDoctorLine =
                    (typeof r.reportDoctorDisplayName === "string" &&
                      r.reportDoctorDisplayName.trim()) ||
                    (typeof structuredR?.doctorName === "string" &&
                      String(structuredR.doctorName).trim()) ||
                    patient?.doctor?.name ||
                    "—";

                  const resolvedExam = resolveExamAndModalityText(
                    r.sectionExamFindings,
                    r.doctorNote,
                  );
                  const previewLen = 220;
                  const doctorNotesDisplay =
                    (typeof r.sectionDoctorNotes === "string" &&
                      r.sectionDoctorNotes.trim()) ||
                    (structuredR &&
                      typeof structuredR.doctorNotes === "string" &&
                      structuredR.doctorNotes.trim()) ||
                    getLegacyFieldValue(r?.doctorNote, "Doktor Notları") ||
                    "-";

                  return (
                    <div
                      key={r.id}
                      className={`max-w-full min-w-0 overflow-hidden rounded-xl border border-slate-200 border-l-4 p-4 shadow-sm ${getReportAccentClass(idx)}`}
                    >
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className="border-slate-300 bg-white text-slate-700"
                          >
                            {t("patientDetailReports.reportNo", {
                              no: clinicalReports.length - idx,
                            })}
                          </Badge>
                          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            {t("patientDetailReports.dateLabel")}
                          </span>
                          <Badge className="bg-slate-700 text-white">
                            {format(new Date(r.createdAt), "dd MMM yyyy", {
                              locale: locale === "en" ? undefined : tr,
                            })}
                          </Badge>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-[#b8ccd6] text-[#355769] transition-colors hover:border-[#91afbd] hover:bg-[#edf6fb] hover:text-[#24485d]"
                          onClick={() => handlePreviewReportPdf(r, "clinical")}
                        >
                          {t("patientDetailReports.viewPdf")}
                        </Button>
                      </div>

                      <div className="mb-3 space-y-1">
                        <p className="text-sm font-semibold text-slate-900">
                          {t("patientDetailReports.reportTitle")}:{" "}
                          {reportTitleLine}
                        </p>
                        <p className="text-xs text-slate-600">
                          {t("patientDetailReports.reportingDoctor")}:{" "}
                          {reportDoctorLine}
                        </p>
                      </div>

                      <p className="mb-3 text-xs leading-relaxed text-slate-500">
                        {t("patientDetailReports.listPreviewNote")}
                      </p>

                      <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3">
                        <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-sm">
                          <p className="text-xs font-semibold text-slate-500">
                            {t("patientDetailReports.anamnesis")}
                          </p>
                          <p className="mt-1.5 break-words text-sm leading-relaxed text-slate-800 [overflow-wrap:anywhere]">
                            {clipReportListPreview(
                              getReportSectionValue(
                                r,
                                "anamnesis",
                                "Klinik Öykü (Anamnez)",
                              ),
                              previewLen,
                            )}
                          </p>
                        </div>

                        <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-sm">
                          <p className="text-xs font-semibold text-slate-500">
                            {t("patientDetailReports.examFindingsCore")}
                          </p>
                          <p className="mt-1.5 break-words text-sm leading-relaxed text-slate-800 [overflow-wrap:anywhere]">
                            {clipReportListPreview(
                              resolvedExam.clinicalExam,
                              previewLen,
                            )}
                          </p>
                        </div>

                        <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-sm">
                          <p className="text-xs font-semibold text-slate-500">
                            {t("patientDetailReports.labResults")}
                          </p>
                          <p className="mt-1.5 break-words text-sm leading-relaxed text-slate-800 [overflow-wrap:anywhere]">
                            {clipReportListPreview(
                              getReportSectionValue(
                                r,
                                "labResults",
                                "Laboratuvar Sonuçları",
                              ),
                              previewLen,
                            )}
                          </p>
                        </div>

                        <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-sm">
                          <p className="text-xs font-semibold text-slate-500">
                            {t("patientDetailReports.clinicalAssessment")}
                          </p>
                          <p className="mt-1.5 break-words text-sm leading-relaxed text-slate-800 [overflow-wrap:anywhere]">
                            {clipReportListPreview(
                              getReportSectionValue(
                                r,
                                "clinicalAssessment",
                                "Teşhis / Klinik Değerlendirme",
                              ),
                              previewLen,
                            )}
                          </p>
                        </div>

                        <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-sm">
                          <p className="text-xs font-semibold text-slate-500">
                            {t("patientDetailReports.treatment")}
                          </p>
                          <p className="mt-1.5 break-words text-sm leading-relaxed text-slate-800 [overflow-wrap:anywhere]">
                            {clipReportListPreview(
                              getTreatmentText(r),
                              previewLen,
                            )}
                          </p>
                        </div>

                        <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-sm">
                          <p className="text-xs font-semibold text-slate-500">
                            {t("patientDetailReports.doctorNotesField")}
                          </p>
                          <p className="mt-1.5 break-words text-sm leading-relaxed text-slate-800 [overflow-wrap:anywhere]">
                            {clipReportListPreview(
                              doctorNotesDisplay,
                              previewLen,
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </CardContent>
          </Card>
        ) : activeTab === "radiological-reports" ? (
          <RadiologicalReportsList
            reports={radiologicalReports}
            patient={patient}
            getReportAccentClass={getReportAccentClass}
            onPreviewPdf={(report) =>
              handlePreviewReportPdf(report, "radiological")
            }
          />
        ) : (
          <div className="space-y-4">
            <Card className="border border-[#d8e0df] bg-white shadow-sm">
              <CardHeader className="border-b border-slate-100">
                <CardTitle>{t("patientDetailProgress.title")}</CardTitle>
                <CardDescription>
                  {t("patientDetailProgress.description")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                {progressionData.length < 2 ? (
                  <p className="text-sm text-slate-600">
                    {t("patientDetailProgress.minRecords")}
                  </p>
                ) : (
                  <>
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="rounded-lg border border-[#d8e0df] bg-[#f8fbff] p-3">
                        <p className="text-xs text-slate-500">
                          {t("patientDetailProgress.latestStatus")}
                        </p>
                        <p className="text-base font-semibold text-slate-900">
                          {
                            progressionData[progressionData.length - 1]
                              .finalDiagnosisLabel
                          }
                        </p>
                      </div>
                      <div className="rounded-lg border border-[#d8e0df] bg-[#f8fbff] p-3">
                        <p className="text-xs text-slate-500">
                          {t("patientDetailProgress.overallChange")}
                        </p>
                        <p className="text-base font-semibold text-slate-900">
                          {netTrendLabel}
                        </p>
                      </div>
                      <div className="rounded-lg border border-[#d8e0df] bg-[#f8fbff] p-3">
                        <p className="text-xs text-slate-500">
                          {t("patientDetailProgress.totalExams")}
                        </p>
                        <p className="text-base font-semibold text-slate-900">
                          {progressionData.length}
                        </p>
                      </div>
                    </div>

                    <div className="h-[320px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={progressionData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="dateLabel" />
                          <YAxis
                            domain={[0, 4]}
                            ticks={[0, 1, 2, 3, 4]}
                            tickFormatter={(value) =>
                              severityLabel(Number(value))
                            }
                          />
                          <Tooltip
                            formatter={(value: number, _name, payload: any) => [
                              payload?.payload?.finalDiagnosisLabel ||
                                `${severityLabel(Number(value))}`,
                              payload?.payload?.trend ||
                                t("patientDetailProgress.statusLabel"),
                            ]}
                            labelFormatter={(label) =>
                              `${t("patientDetailProgress.dateLabel")}: ${label}`
                            }
                          />
                          <Line
                            type="monotone"
                            dataKey="stage"
                            stroke="#1e90ff"
                            strokeWidth={3}
                            activeDot={{ r: 7 }}
                            name={t("patientDetailProgress.retinopathyLevel")}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="rounded-lg border border-[#d8e0df] bg-white">
                      <Table>
                        <TableHeader className="bg-slate-50">
                          <TableRow>
                            <TableHead>
                              {t("patientDetailProgress.dateLabel")}
                            </TableHead>
                            <TableHead>
                              {t("patientDetailProgress.colAiResult")}
                            </TableHead>
                            <TableHead>
                              {t("patientDetailProgress.colFinalResult")}
                            </TableHead>
                            <TableHead>
                              {t("patientDetailProgress.colChangeComment")}
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {progressionData.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell>{item.dateLabel}</TableCell>
                              <TableCell>
                                <Badge>{item.aiResultLabel}</Badge>
                              </TableCell>
                              <TableCell>
                                <Badge>{item.finalDiagnosisLabel}</Badge>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  className={
                                    item.trendType === "improvement"
                                      ? "bg-emerald-500 text-white"
                                      : item.trendType === "worsening"
                                        ? "bg-red-500 text-white"
                                        : "bg-slate-500 text-white"
                                  }
                                >
                                  {item.trend}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
