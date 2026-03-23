"use client";

import { useState } from "react";
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
import {
  type AiAnalysisDraft,
  ImageAnalysisCard,
} from "@/components/dashboard/image-analysis-card";
import { ChevronDown, ClipboardPlus, Sparkles, X } from "lucide-react";

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

const MANUAL_REPORT_CONFIDENCE = 0.85;
const REPORT_FORMAT_VERSION = "manual_report_v2";
const CANONICAL_RISK_LABELS = new Set([
  "No_DR",
  "Mild",
  "Moderate",
  "Severe",
  "Proliferative_DR",
]);

const normalizeRisk = (value?: string | null) =>
  String(value || "")
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

const resolveRiskForSave = (value?: string | null) => {
  if (CANONICAL_RISK_LABELS.has(String(value || ""))) {
    return String(value);
  }

  const key = normalizeRisk(value);
  if (
    ["dusuk_risk", "hafif", "hafif_evre", "healthy", "saglikli"].includes(key)
  ) {
    return "Mild";
  }
  if (["orta_risk", "orta", "orta_evre"].includes(key)) {
    return "Moderate";
  }
  if (["yuksek_risk", "agir", "agir_evre", "ciddi"].includes(key)) {
    return "Severe";
  }
  if (["kritik_risk", "cok_ileri_evre", "proliferative"].includes(key)) {
    return "Proliferative_DR";
  }
  if (["yok", "none", "normal", "no_dr"].includes(key)) {
    return "No_DR";
  }

  return "No_DR";
};

export function ManualReportCard({
  patientId,
  patientInfo,
  doctorName,
}: ManualReportCardProps) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [aiDraft, setAiDraft] = useState<AiAnalysisDraft | null>(null);
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [reportTitle, setReportTitle] = useState("Göz Muayene Raporu");
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
      const riskForSave = resolveRiskForSave(patientInfo.risk);
      const finalAiLabel = aiDraft?.correctionLabel || aiDraft?.aiResult;
      const finalRiskForSave = finalAiLabel || riskForSave;
      const finalConfidence =
        typeof aiDraft?.confidence === "number"
          ? aiDraft.confidence
          : MANUAL_REPORT_CONFIDENCE;

      const aiSummary = aiDraft
        ? [
            `AI Analiz Sonucu: ${aiDraft.aiResult}`,
            `AI Güven Oranı: %${Math.round((aiDraft.confidence || 0) * 100)}`,
            `AI Düzeltme: ${aiDraft.correctionLabel || "Yok"}`,
          ].join(" | ")
        : "AI Analizi Eklenmedi";

      const reportBody = JSON.stringify({
        version: REPORT_FORMAT_VERSION,
        reportTitle: reportTitle.trim() || "Göz Muayene Raporu",
        reportDate: reportDate || "-",
        patientInfo: {
          fullName: patientInfo.fullName,
          tcNo: patientInfo.tcNo,
          age: patientInfo.age ?? null,
          gender: patientInfo.gender ?? null,
        },
        doctorName: doctorName || "Belirtilmedi",
        sections: {
          anamnesis: anamnesis.trim() || "-",
          examFindings: examFindings.trim() || "-",
          labResults: labResults.trim() || "-",
          clinicalAssessment: clinicalAssessment.trim() || "-",
          treatmentRecommendations: treatmentRecommendations.trim() || "-",
        },
        doctorNotes: doctorNotes.trim() || "-",
        aiSummary,
      });

      await saveAnalysisAction({
        patientId,
        aiResult: finalRiskForSave,
        confidence: finalConfidence,
        heatmapUrl: aiDraft?.heatmapUrl,
        originalImage: aiDraft?.originalImage,
        aiOdriLabels: aiDraft?.aiOdriLabels,
        aiOdriConfidences: aiDraft?.aiOdriConfidences,
        doctorNote: reportBody,
        ilaclar: treatmentRecommendations.trim(),
        drFeedback: aiDraft?.correctionLabel,
      });

      toast({
        title: "Rapor kaydedildi",
        description: aiDraft
          ? "AI destekli klinik rapor başarıyla oluşturuldu."
          : "Görüntü yüklemeden klinik rapor başarıyla oluşturuldu.",
        duration: 4000,
      });

      setAnamnesis("");
      setExamFindings("");
      setLabResults("");
      setClinicalAssessment("");
      setTreatmentRecommendations("");
      setDoctorNotes("");
      window.location.reload();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Hata",
        description:
          error instanceof Error
            ? error.message
            : "Manuel rapor kaydedilemedi.",
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
          Rapor Oluştur
        </CardTitle>
        <CardDescription>
          Görsel yükleme zorunlu değildir. Standart göz kliniği rapor alanlarını
          doldurarak doğrudan rapor oluşturabilirsiniz.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {aiDraft ? (
          <div className="flex items-start justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            <div>
              <p className="flex items-center gap-2 font-medium">
                <Sparkles className="h-4 w-4" /> AI analizi rapora eklenecek
              </p>
              <p className="mt-1 text-xs text-emerald-800">
                Sonuç: {aiDraft.correctionLabel || aiDraft.aiResult} | Güven: %
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
            AI analizi zorunlu değildir. İsterseniz aşağıdaki AI bölümünden
            analiz yaparak sonucu bu rapora tek kaydetme akışıyla dahil
            edebilirsiniz.
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm text-slate-700 md:col-span-2">
            <span>Rapor Başlığı</span>
            <Input
              value={reportTitle}
              onChange={(e) => setReportTitle(e.target.value)}
              placeholder="Örn: Göz Muayene Raporu"
            />
          </label>

          <label className="space-y-1 text-sm text-slate-700">
            <span>Hasta Kimlik Bilgileri</span>
            <Input
              value={`${patientInfo.fullName} | T.C: ${patientInfo.tcNo}`}
              disabled
            />
          </label>

          <label className="space-y-1 text-sm text-slate-700">
            <span>Rapor Tarihi</span>
            <Input
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
            />
          </label>

          <label className="space-y-1 text-sm text-slate-700">
            <span>Doktor Bilgisi</span>
            <Input value={doctorName || "Belirtilmedi"} disabled />
          </label>
        </div>

        <label className="space-y-1 text-sm text-slate-700 block">
          <span>Klinik Öykü (Anamnez)</span>
          <Textarea
            value={anamnesis}
            onChange={(e) => setAnamnesis(e.target.value)}
            placeholder="Hastanın şikayeti, semptom süresi, önceki tedavi öyküsü"
            rows={3}
          />
        </label>

        <label className="space-y-1 text-sm text-slate-700 block">
          <span>Muayene Bulguları</span>
          <Textarea
            value={examFindings}
            onChange={(e) => setExamFindings(e.target.value)}
            placeholder="Görme keskinliği, biyomikroskopi, fundus muayenesi bulguları"
            rows={3}
          />
        </label>

        <label className="space-y-1 text-sm text-slate-700 block">
          <span>Laboratuvar Sonuçları</span>
          <Textarea
            value={labResults}
            onChange={(e) => setLabResults(e.target.value)}
            placeholder="HbA1c, glukoz, lipid profili gibi laboratuvar bilgileri"
            rows={3}
          />
        </label>

        <label className="space-y-1 text-sm text-slate-700 block">
          <span>Teşhis / Klinik Değerlendirme</span>
          <Textarea
            value={clinicalAssessment}
            onChange={(e) => setClinicalAssessment(e.target.value)}
            placeholder="Klinik değerlendirme ve nihai tanı"
            rows={4}
          />
        </label>

        <label className="space-y-1 text-sm text-slate-700 block">
          <span>Tedavi ve Öneriler</span>
          <Textarea
            value={treatmentRecommendations}
            onChange={(e) => setTreatmentRecommendations(e.target.value)}
            placeholder="Tedavi planı, ilaç önerileri ve kontrol önerisi"
            rows={4}
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
              <span>AI Analiz (Opsiyonel)</span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${isAiOpen ? "rotate-180" : ""}`}
              />
            </Button>
          </CollapsibleTrigger>

          <CollapsibleContent className="space-y-2 border-t border-slate-200 p-3">
            <ImageAnalysisCard
              compact
              patientId={patientId}
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
          <span>Doktor Notları</span>
          <Textarea
            value={doctorNotes}
            onChange={(e) => setDoctorNotes(e.target.value)}
            placeholder="Ek klinik notlar, özel uyarılar veya takip planı"
            rows={4}
          />
        </label>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={busy}>
            {busy
              ? "Kaydediliyor..."
              : aiDraft
                ? "Rapor + AI Sonucunu Kaydet"
                : "Raporu Kaydet"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
