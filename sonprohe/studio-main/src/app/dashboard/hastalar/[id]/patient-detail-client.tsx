"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ImageAnalysisCard } from "@/components/dashboard/image-analysis-card";
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

export default function PatientDetailClient({ patient }: { patient: any }) {
  const [activeTab, setActiveTab] = useState<
    "analysis" | "reports" | "progress"
  >("analysis");
  const [editOpen, setEditOpen] = useState(false);

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
      medications: report.ilaclar,
      originalImage: report.originalImage,
      heatmapUrl: report.heatmapUrl,
    };

    const settings = loadRetinaSettingsFromStorage();
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
            className="bg-[var(--retina-primary)] text-white hover:bg-[var(--retina-primary-deep)]"
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

      <div className="flex gap-4">
        <Button
          className="bg-[var(--retina-primary)] text-white hover:bg-[var(--retina-primary-deep)]"
          variant={activeTab === "analysis" ? "default" : "outline"}
          onClick={() => setActiveTab("analysis")}
        >
          Yeni Analiz
        </Button>
        <Button
          className="border-[#cfd8d7] bg-white text-[#476775] hover:bg-[#eef3f2]"
          variant={activeTab === "reports" ? "default" : "outline"}
          onClick={() => setActiveTab("reports")}
        >
          Geçmiş Raporlar
        </Button>
        <Button
          className="border-[#cfd8d7] bg-white text-[#476775] hover:bg-[#eef3f2]"
          variant={activeTab === "progress" ? "default" : "outline"}
          onClick={() => setActiveTab("progress")}
        >
          Değişim Analizi
        </Button>
      </div>

      {activeTab === "analysis" ? (
        <ImageAnalysisCard
          patientId={patient.id}
          patientInfo={{
            fullName: patient.fullName,
            tcNo: patient.tcNo,
            age: patient.age,
          }}
          doctorName={patient?.doctor?.name}
        />
      ) : activeTab === "reports" ? (
        <Card className="border border-[#d8e0df] bg-white shadow-sm">
          <CardHeader className="border-b border-slate-100">
            <CardTitle>Geçmiş Analizler</CardTitle>
            <CardDescription>{reports.length} kayıt bulundu</CardDescription>
          </CardHeader>

          <CardContent className="overflow-x-auto">
            <Table className="min-w-[900px]">
              <TableHeader className="bg-slate-100">
                <TableRow className="h-12">
                  <TableHead className="px-4 py-2 text-left">Tarih</TableHead>
                  <TableHead className="px-4 py-2 text-left">
                    AI Diyabetik Retinopati Sonucu
                  </TableHead>
                  <TableHead className="px-4 py-2 text-left">
                    Güven Oranı
                  </TableHead>
                  <TableHead>Doktor Geri Bildirimi</TableHead>
                  <TableHead className="px-4 py-2 text-left">
                    AI Diğer Hastalıkların Risk Tahmini
                  </TableHead>
                  <TableHead className="px-4 py-2 text-left">
                    Güven Oranı
                  </TableHead>
                  <TableHead className="px-4 py-2 text-left">
                    Fundus Görüntüsü
                  </TableHead>
                  <TableHead className="px-4 py-2 text-left">
                    Isı Haritası
                  </TableHead>
                  <TableHead className="px-4 py-2 text-left">
                    Doktor Yorumu
                  </TableHead>
                  <TableHead className="px-4 py-2 text-left">
                    Hastanın İlaçları
                  </TableHead>
                  <TableHead className="px-4 py-2 text-left">PDF</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {reports.map((r: any) => (
                  <TableRow key={r.id} className="h-16 hover:bg-slate-50">
                    <TableCell className="px-4 py-2">
                      {format(new Date(r.createdAt), "dd MMM yyyy", {
                        locale: tr,
                      })}
                    </TableCell>
                    <TableCell className="px-4 py-2">
                      <Badge>{formatDiagnosisLabel(r.aiResult || "-")}</Badge>
                    </TableCell>
                    <TableCell className="px-4 py-2">
                      %{Math.round(r.confidence * 100)}
                    </TableCell>
                    <TableCell>
                      <Badge>
                        {formatDiagnosisLabel(resolveEffectiveDiagnosis(r))}
                      </Badge>
                    </TableCell>

                    <TableCell className="px-4 py-2">
                      <Badge>
                        {r.aiOdriLabels
                          ? JSON.parse(r.aiOdriLabels).join(", ")
                          : "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-4 py-2">
                      <Badge>
                        {r.aiOdriConfidences
                          ? JSON.parse(r.aiOdriConfidences)
                              .map((c: number) => `${Math.round(c * 100)}%`)
                              .join(", ")
                          : "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-4 py-2">
                      {r.originalImage && (
                        <img
                          src={r.originalImage}
                          className="w-16 h-16 rounded border border-slate-200"
                        />
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-2">
                      {r.heatmapUrl && (
                        <img
                          src={r.heatmapUrl}
                          className="w-16 h-16 rounded border border-slate-200"
                        />
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-2 max-w-[250px] text-xs">
                      {r.doctorNote ?? "—"}
                    </TableCell>
                    <TableCell className="px-4 py-2">
                      <Badge>{r.ilaclar}</Badge>
                    </TableCell>
                    <TableCell className="px-4 py-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handlePreviewReportPdf(r)}
                      >
                        PDF Görüntüle
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card className="border border-[#d8e0df] bg-white shadow-sm">
            <CardHeader className="border-b border-slate-100">
              <CardTitle>Klinik Sonuç Değişim Grafiği</CardTitle>
              <CardDescription>
                Nihai sonuc hesaplamasi Gecmis Raporlar ile aynidir: doktor geri
                bildirimi varsa o, yoksa AI sonucu kullanilir.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              {progressionData.length < 2 ? (
                <p className="text-sm text-slate-600">
                  Degisim analizi icin en az 2 analiz kaydi gerekli.
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
