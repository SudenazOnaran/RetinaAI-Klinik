"use client";

import { useState } from "react";
import jsPDF from "jspdf";
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

export default function PatientDetailClient({ patient }: { patient: any }) {
  const [activeTab, setActiveTab] = useState<"analysis" | "reports">(
    "analysis",
  );
  const [editOpen, setEditOpen] = useState(false);

  const reports = patient.analyses ?? [];

  /* 🧾 PDF OLUŞTURMA */
  const downloadPDF = (r: any) => {
    const pdf = new jsPDF();

    pdf.setFontSize(14);
    pdf.text("AI Retina Analiz Raporu", 20, 20);

    pdf.setFontSize(10);
    pdf.text(`Hasta: ${patient.fullName}`, 20, 35);
    pdf.text(`TC: ${patient.tcNo}`, 20, 42);
    pdf.text(
      `Tarih: ${format(new Date(r.createdAt), "dd.MM.yyyy HH:mm")}`,
      20,
      49,
    );

    pdf.line(20, 55, 190, 55);

    pdf.text(`AI Teşhisi: ${r.aiResult}`, 20, 65);
    pdf.text(`Güven: %${Math.round(r.confidence * 100)}`, 20, 72);

    if (r.doctorNote) {
      pdf.text("Doktor Yorumu:", 20, 85);
      pdf.text(r.doctorNote, 20, 92, { maxWidth: 170 });
    }

    pdf.save(`analiz-${patient.tcNo}-${r.id}.pdf`);
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
      </div>

      {activeTab === "analysis" ? (
        <ImageAnalysisCard patientId={patient.id} />
      ) : (
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
                      <Badge>{r.aiResult}</Badge>
                    </TableCell>
                    <TableCell className="px-4 py-2">
                      %{Math.round(r.confidence * 100)}
                    </TableCell>
                    <TableCell>
                      <Badge>
                        {r.drFeedback
                          ? r.drFeedback.replace("_", " ")
                          : "AI Sonucu Doğru"}
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
                        className="bg-[var(--retina-primary)] text-white hover:bg-[var(--retina-primary-deep)]"
                        onClick={() => downloadPDF(r)}
                      >
                        PDF İndir
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
