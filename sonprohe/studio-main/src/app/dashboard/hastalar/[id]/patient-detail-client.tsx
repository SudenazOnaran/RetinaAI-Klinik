"use client";

import { useEffect, useState } from "react";
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
  downloadRetinaReportPdf,
  previewRetinaReportPdf,
} from "@/lib/retina-report-pdf";
import { loadRetinaSettingsFromStorage } from "@/lib/retina-settings";
import { ManualReportCard } from "@/components/dashboard/manual-report-card";

export default function PatientDetailClient({ patient }: { patient: any }) {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<
    "report-create" | "reports" | "progress"
  >("report-create");
  const [editOpen, setEditOpen] = useState(false);

  const tabButtonClass = (tab: "report-create" | "reports" | "progress") =>
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

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "reports") {
      setActiveTab("reports");
      return;
    }
    if (tab === "progression") {
      setActiveTab("progress");
      return;
    }
    setActiveTab("report-create");
  }, [searchParams]);

  const reports = patient.analyses ?? [];

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

  const isAiIncludedInReport = (report: any) => {
    const structured = parseStructuredReport(report?.doctorNote);
    if (typeof structured?.aiIncluded === "boolean") {
      return structured.aiIncluded;
    }

    const summaryText = String(structured?.aiSummary || "")
      .trim()
      .toLocaleLowerCase("tr-TR");

    if (summaryText.includes("ai analizi eklenmedi")) {
      return false;
    }

    return Boolean(report?.originalImage || report?.heatmapUrl);
  };

  const normalizeDiagnosisKey = (value: unknown) => {
    return String(value || "")
      .trim()
      .toLocaleLowerCase("tr-TR")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/ı/g, "i")
      .replace(/ç/g, "c")
      .replace(/ğ/g, "g")
      .replace(/ö/g, "o")
      .replace(/ş/g, "s")
      .replace(/ü/g, "u")
      .replace(/\s+/g, "_");
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

  const formatDiagnosisLabel = (label: string) => {
    return label.replaceAll("_", " ");
  };

  const isApprovalFeedback = (value: unknown) => {
    const normalized = normalizeDiagnosisKey(value);
    return [
      "ai_sonucu_doğru",
      "ai_sonucu_dogru",
      "ai_doğru",
      "ai_dogru",
      "dogru",
      "doğru",
      "evet",
      "yes",
      "correct",
    ].includes(normalized);
  };

  // Report saving flow stores these canonical DR labels.
  const toReportDiagnosisLabel = (value: unknown) => {
    const normalized = normalizeDiagnosisKey(value);

    if (!normalized) return null;
    if (normalized === "dusuk_risk") return "Mild";
    if (normalized === "orta_risk") return "Moderate";
    if (normalized === "yuksek_risk") return "Severe";
    if (normalized === "kritik_risk") return "Proliferative_DR";
    if (normalized === "no_dr") return "No_DR";
    if (normalized === "mild") return "Mild";
    if (normalized === "moderate") return "Moderate";
    if (normalized === "severe") return "Severe";
    if (normalized === "proliferative_dr") return "Proliferative_DR";

    // Legacy aliases still encountered in older rows.
    if (["yok", "healthy", "saglikli"].includes(normalized)) return "No_DR";
    if (["hafif", "hafif_evre"].includes(normalized)) return "Mild";
    if (["orta", "orta_evre"].includes(normalized)) return "Moderate";
    if (["ciddi", "agir", "agir_evre"].includes(normalized)) return "Severe";
    if (
      ["proliferative", "proliferatif", "cok_ileri_evre"].includes(normalized)
    )
      return "Proliferative_DR";

    return null;
  };

  const resolveEffectiveDiagnosis = (report: any) => {
    const doctorFeedback = getDoctorFeedback(report);
    if (doctorFeedback && !isApprovalFeedback(doctorFeedback)) {
      return doctorFeedback;
    }
    if (report?.aiResult) return report.aiResult;
    return "No_DR";
  };

  const getSeverityScore = (label: string) => {
    const canonical = toReportDiagnosisLabel(label);

    if (canonical === "Proliferative_DR") return 4;
    if (canonical === "Severe") return 3;
    if (canonical === "Moderate") return 2;
    if (canonical === "Mild") return 1;
    return 0;
  };

  const severityLabel = (score: number) => {
    if (score >= 4) return "Proliferatif";
    if (score === 3) return "Ciddi";
    if (score === 2) return "Orta";
    if (score === 1) return "Hafif";
    return "Yok";
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
          locale: tr,
        }),
        aiResultLabel,
        finalDiagnosisRaw,
        finalDiagnosisLabel,
        stage: score,
        stageLabel: severityLabel(score),
        delta,
        trend: delta < 0 ? "İyileşme" : delta > 0 ? "Kötüleşme" : "Stabil",
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
      ? "Genel İyileşme"
      : netChange > 0
        ? "Genel Kötüleşme"
        : "Genel Stabil";

  const handlePreviewReportPdf = async (report: any) => {
    const labels = parseJsonArray(report.aiOdriLabels);
    const confidences = parseJsonArray(report.aiOdriConfidences);
    const odirResults = labels.map((label: string, idx: number) => ({
      label,
      confidence: Number(confidences[idx] ?? 0),
    }));

    const structured = parseStructuredReport(report.doctorNote);
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
      doctorNote: report.doctorNote,
      medications: getTreatmentText(report),
      originalImage: report.originalImage,
      heatmapUrl: report.heatmapUrl,
      reportTitle: structured?.reportTitle,
      reportDateLabel: structured?.reportDate,
    };

    const settings = loadRetinaSettingsFromStorage();

    try {
      await fetch("/api/audit/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "DOWNLOAD",
          entityType: "REPORT",
          entityId: report.id,
          description: "Hasta detayindan PDF rapor indirildi/önizlendi",
          metadata: {
            patientId: patient.id,
            autoOpenPreview: settings.report.autoOpenPreview,
          },
        }),
      });
    } catch {
      // Log hatasi PDF akisina engel olmasin.
    }

    if (settings.report.autoOpenPreview) {
      await previewRetinaReportPdf(payload);
    } else {
      await downloadRetinaReportPdf(payload);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <Card className="border border-[#d8e0df] bg-white shadow-sm">
        <CardContent className="flex flex-col justify-between gap-4 p-6 md:flex-row md:items-center">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              {patient.fullName}
            </h1>
            <p className="text-sm text-slate-600">
              TC: {patient.tcNo} | Yaş: {patient.age} | Diyabet Süresi:{" "}
              {patient.diabetesYears ?? "-"} | HbA1c: {patient.hba1c ?? "-"}
            </p>
          </div>

          <Button
            className="h-11 rounded-xl bg-[var(--retina-primary)] px-5 text-white shadow-sm transition-all duration-200 hover:bg-[var(--retina-primary-deep)] hover:shadow-md"
            onClick={() => setEditOpen(true)}
          >
            Bilgileri Güncelle{" "}
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
          Rapor Oluştur
        </Button>
        <Button
          className={tabButtonClass("reports")}
          variant="outline"
          onClick={() => setActiveTab("reports")}
        >
          Geçmiş Raporlar
        </Button>
        <Button
          className={tabButtonClass("progress")}
          variant="outline"
          onClick={() => setActiveTab("progress")}
        >
          DR Değişim Analizi
        </Button>
      </div>

      {activeTab === "report-create" ? (
        <Card className="border border-[#d8e0df] bg-white shadow-sm">
          <CardContent className="space-y-4 p-4 md:p-5">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              Bu sayfada klinik rapor ve AI görsel analiz tek akışta çalışır. AI
              analizi Rapor Oluştur kartının içindedir ve sonuçlar aynı kaydetme
              işlemiyle rapora eklenir.
            </div>

            <ManualReportCard
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
            <CardTitle>Geçmiş Raporlar</CardTitle>
            <CardDescription>{reports.length} kayıt bulundu</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 pt-4">
            {[...reports]
              .sort(
                (a: any, b: any) =>
                  new Date(b.createdAt).getTime() -
                  new Date(a.createdAt).getTime(),
              )
              .map((r: any, idx: number) => {
                const odirLabels = parseJsonArray(r.aiOdriLabels);
                const odirConfs = parseJsonArray(r.aiOdriConfidences);
                const hasAiAnalysis = isAiIncludedInReport(r);
                const aiRiskLabel = hasAiAnalysis
                  ? formatDiagnosisLabel(resolveEffectiveDiagnosis(r) || "-")
                  : "-";
                const aiConfidenceLabel =
                  hasAiAnalysis && Number.isFinite(Number(r.confidence))
                    ? `%${Math.round(Number(r.confidence) * 100)}`
                    : "-";

                return (
                  <div
                    key={r.id}
                    className={`rounded-xl border border-slate-200 border-l-4 p-4 shadow-sm ${getReportAccentClass(idx)}`}
                  >
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className="border-slate-300 bg-white text-slate-700"
                        >
                          Rapor #{reports.length - idx}
                        </Badge>
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Tarih
                        </span>
                        <Badge className="bg-slate-700 text-white">
                          {format(new Date(r.createdAt), "dd MMM yyyy", {
                            locale: tr,
                          })}
                        </Badge>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-[#b8ccd6] text-[#355769] transition-colors hover:border-[#91afbd] hover:bg-[#edf6fb] hover:text-[#24485d]"
                        onClick={() => handlePreviewReportPdf(r)}
                      >
                        PDF Görüntüle
                      </Button>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      <div className="rounded-lg border border-slate-200 bg-white p-3">
                        <p className="text-xs font-semibold text-slate-500">
                          Klinik Öykü (Anamnez)
                        </p>
                        <p className="mt-1 text-sm text-slate-800">
                          {getReportSectionValue(
                            r,
                            "anamnesis",
                            "Klinik Öykü (Anamnez)",
                          )}
                        </p>
                      </div>

                      <div className="rounded-lg border border-slate-200 bg-white p-3">
                        <p className="text-xs font-semibold text-slate-500">
                          Muayene Bulguları
                        </p>
                        <p className="mt-1 text-sm text-slate-800">
                          {getReportSectionValue(
                            r,
                            "examFindings",
                            "Muayene Bulguları",
                          )}
                        </p>
                      </div>

                      <div className="rounded-lg border border-slate-200 bg-white p-3">
                        <p className="text-xs font-semibold text-slate-500">
                          Laboratuvar Sonuçları
                        </p>
                        <p className="mt-1 text-sm text-slate-800">
                          {getReportSectionValue(
                            r,
                            "labResults",
                            "Laboratuvar Sonuçları",
                          )}
                        </p>
                      </div>

                      <div className="rounded-lg border border-slate-200 bg-white p-3">
                        <p className="text-xs font-semibold text-slate-500">
                          Teşhis / Klinik Değerlendirme
                        </p>
                        <p className="mt-1 text-sm text-slate-800">
                          {getReportSectionValue(
                            r,
                            "clinicalAssessment",
                            "Teşhis / Klinik Değerlendirme",
                            hasAiAnalysis
                              ? formatDiagnosisLabel(
                                  resolveEffectiveDiagnosis(r) || "-",
                                )
                              : "-",
                          )}
                        </p>
                      </div>

                      <div className="rounded-lg border border-slate-200 bg-white p-3">
                        <p className="text-xs font-semibold text-slate-500">
                          Tedavi ve Öneriler
                        </p>
                        <p className="mt-1 text-sm text-slate-800">
                          {getTreatmentText(r)}
                        </p>
                      </div>

                      <div className="rounded-lg border border-slate-200 bg-white p-3">
                        <p className="text-xs font-semibold text-slate-500">
                          AI/DR Risk Tahmini - Güven
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <Badge>{aiRiskLabel}</Badge>
                          <Badge
                            variant="outline"
                            className="border-[#c5d8d3] bg-[#edf6f3] text-[#446b62]"
                          >
                            {aiConfidenceLabel}
                          </Badge>
                        </div>
                      </div>

                      <div className="rounded-lg border border-slate-200 bg-white p-3 md:col-span-2 xl:col-span-1">
                        <p className="text-xs font-semibold text-slate-500">
                          AI Diğer Hastalık Risk Tahmini - Güven
                        </p>
                        <p className="mt-1 text-sm text-slate-800">
                          {odirLabels.length > 0
                            ? odirLabels
                                .map(
                                  (label: string, i: number) =>
                                    `${label} (%${Math.round(Number(odirConfs[i] ?? 0) * 100)})`,
                                )
                                .join(", ")
                            : "-"}
                        </p>
                      </div>

                      <div className="rounded-lg border border-slate-200 bg-white p-3">
                        <p className="text-xs font-semibold text-slate-500">
                          Fundus Görseli
                        </p>
                        {r.originalImage ? (
                          <Image
                            src={r.originalImage}
                            alt="Fundus"
                            width={96}
                            height={96}
                            unoptimized
                            className="mt-2 h-24 w-24 rounded border border-slate-200 object-cover"
                          />
                        ) : (
                          <p className="mt-1 text-sm text-slate-500">-</p>
                        )}
                      </div>

                      <div className="rounded-lg border border-slate-200 bg-white p-3">
                        <p className="text-xs font-semibold text-slate-500">
                          Isı Haritası
                        </p>
                        {r.heatmapUrl ? (
                          <Image
                            src={r.heatmapUrl}
                            alt="Isı Haritası"
                            width={96}
                            height={96}
                            unoptimized
                            className="mt-2 h-24 w-24 rounded border border-slate-200 object-cover"
                          />
                        ) : (
                          <p className="mt-1 text-sm text-slate-500">-</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card className="border border-[#d8e0df] bg-white shadow-sm">
            <CardHeader className="border-b border-slate-100">
              <CardTitle>Klinik Sonuç Değişim Grafiği</CardTitle>
              <CardDescription>
                Diyabetik retinopati teşhisleri kayıtlı hastaların hastalık
                takip grafiği.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              {progressionData.length < 2 ? (
                <p className="text-sm text-slate-600">
                  Değişim analizi için en az 2 analiz kaydı gerekli.
                </p>
              ) : (
                <>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-lg border border-[#d8e0df] bg-[#f8fbff] p-3">
                      <p className="text-xs text-slate-500">Son Durum</p>
                      <p className="text-base font-semibold text-slate-900">
                        {
                          progressionData[progressionData.length - 1]
                            .finalDiagnosisLabel
                        }
                      </p>
                    </div>
                    <div className="rounded-lg border border-[#d8e0df] bg-[#f8fbff] p-3">
                      <p className="text-xs text-slate-500">Genel Değişim</p>
                      <p className="text-base font-semibold text-slate-900">
                        {netTrendLabel}
                      </p>
                    </div>
                    <div className="rounded-lg border border-[#d8e0df] bg-[#f8fbff] p-3">
                      <p className="text-xs text-slate-500">Toplam Muayene</p>
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
                            payload?.payload?.trend || "Durum",
                          ]}
                          labelFormatter={(label) => `Tarih: ${label}`}
                        />
                        <Line
                          type="monotone"
                          dataKey="stage"
                          stroke="#1e90ff"
                          strokeWidth={3}
                          activeDot={{ r: 7 }}
                          name="Retinopati Seviyesi"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="rounded-lg border border-[#d8e0df] bg-white">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead>Tarih</TableHead>
                          <TableHead>AI Sonucu</TableHead>
                          <TableHead>Nihai Sonuç</TableHead>
                          <TableHead>Değişim Yorumu</TableHead>
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
                                  item.trend === "İyileşme"
                                    ? "bg-emerald-500 text-white"
                                    : item.trend === "Kötüleşme"
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
  );
}
