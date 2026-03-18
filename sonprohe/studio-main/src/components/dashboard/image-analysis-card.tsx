"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";

import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Upload, X, Loader2, Save, Zap, ShieldCheck } from "lucide-react";
import { saveAnalysisAction } from "@/app/actions/save-analysis";
import {
  downloadRetinaReportPdf,
  previewRetinaReportPdf,
} from "@/lib/retina-report-pdf";
import { loadRetinaSettingsFromStorage } from "@/lib/retina-settings";
import { isCriticalAlertCandidate } from "@/lib/risk-alerts";

type PatientReportInfo = {
  fullName?: string;
  tcNo?: string;
  age?: number;
};

type ImageAnalysisCardProps = {
  patientId: string;
  patientInfo?: PatientReportInfo;
  doctorName?: string;
};

export function ImageAnalysisCard({
  patientId,
  patientInfo,
  doctorName,
}: ImageAnalysisCardProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [base64Image, setBase64Image] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);
  const [doctorNote, setDoctorNote] = useState("");
  const [ilaclar, setIlaclar] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [actualResult, setActualResult] = useState("");

  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    const reader = new FileReader();
    reader.onloadend = () => setBase64Image(reader.result as string);
    reader.readAsDataURL(f);
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setIsLoading(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch("http://localhost:5000/predict", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (data.success) setResult(data);
      else throw new Error(data.message || "Analiz başarısız");
    } catch {
      toast({
        variant: "destructive",
        title: "Hata",
        description: "AI servisine bağlanılamadı.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinalSave = async () => {
    if (!result) return;
    setIsLoading(true);
    try {
      const saveResult = await saveAnalysisAction({
        patientId,
        aiResult: result.pytorch.label,
        drFeedback: isCorrect === false ? actualResult : undefined,
        aiOdriLabels: result.odir?.results.map((r: any) => r.label) || [],
        aiOdriConfidences:
          result.odir?.results.map((r: any) => r.confidence) || [],
        confidence: result.pytorch.confidence,
        heatmapUrl: result.heatmapPlus,
        originalImage: base64Image || "",
        doctorNote,
        ilaclar,
      });

      const settings = loadRetinaSettingsFromStorage();
      if (
        settings.notifications.criticalCaseAlert &&
        isCriticalAlertCandidate(
          saveResult.finalRiskStatus,
          saveResult.confidence,
          settings,
        )
      ) {
        toast({
          variant: "destructive",
          title: "Kritik vaka uyarısı",
          description:
            "Yüksek riskli analiz algılandı. Hastayı öncelikli takibe alın.",
        });
      }

      toast({ title: "Başarılı", description: "Analiz kaydedildi." });

      setFile(null);
      setPreviewUrl(null);
      setBase64Image(null);
      setResult(null);
      setDoctorNote("");
      setIlaclar("");
      setIsCorrect(null);
      setActualResult("");
      window.location.reload();
    } catch (err: any) {
      console.error("Analiz kaydedilemedi hata detayı:", err);
      toast({
        variant: "destructive",
        title: "Hata",
        description: `Analiz kaydedilemedi: ${err.message || err}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePreviewPDF = async () => {
    if (!result) return;

    try {
      const settings = loadRetinaSettingsFromStorage();
      const payload = {
        patientId,
        patientInfo,
        doctorName,
        aiResult: result.pytorch.label,
        confidence: result.pytorch.confidence,
        odirResults: result.odir?.results ?? [],
        clinicalFinalResult:
          isCorrect === false && actualResult
            ? actualResult
            : result.pytorch.label,
        doctorNote,
        medications: ilaclar,
        originalImage: base64Image || previewUrl,
        heatmapUrl: result.heatmapPlus,
      };

      if (settings.report.autoOpenPreview) {
        await previewRetinaReportPdf(payload);
      } else {
        await downloadRetinaReportPdf(payload);
      }
    } catch {
      toast({
        variant: "destructive",
        title: "Hata",
        description: "PDF oluşturulurken hata oluştu.",
      });
    }
  };

  return (
    <Card className="w-full overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white shadow-xl">
      <CardHeader className="space-y-2 border-b border-slate-200 bg-white/90 pb-5">
        <CardTitle className="text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">
          GÖRÜNTÜ ANALİZİ
        </CardTitle>
        <CardDescription className="max-w-3xl text-sm text-slate-600 md:text-base">
          Retina fundus görüntüsünü klinik akış için hızlı şekilde analiz edin,
          açıklama haritalarını karşılaştırın ve raporu kaydedin.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6 p-4 md:p-6">
        {!previewUrl ? (
          <div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-cyan-300 bg-cyan-50/40 p-10 text-center transition-colors hover:border-cyan-400 hover:bg-cyan-50 md:p-14">
            <Upload className="mx-auto mb-4 h-12 w-12 text-cyan-700" />
            <p className="text-base font-semibold text-slate-800 md:text-lg">
              Fundus görüntüsü seçin
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Desteklenen formatlar: JPG, PNG, BMP, WEBP
            </p>
            <input
              type="file"
              accept="image/*"
              className="absolute inset-0 cursor-pointer opacity-0"
              onChange={handleFileChange}
            />
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-950">
            <img
              src={previewUrl}
              alt="Preview"
              className="h-[320px] w-full object-contain md:h-[420px]"
            />
            <Button
              variant="destructive"
              size="icon"
              className="absolute right-3 top-3 h-9 w-9 rounded-xl"
              onClick={() => {
                setPreviewUrl(null);
                setBase64Image(null);
                setResult(null);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {result && (
          <div className="grid gap-5 xl:grid-cols-[330px_minmax(0,1fr)]">
            <div className="space-y-4">
              <div className="rounded-2xl border border-cyan-100 bg-gradient-to-br from-cyan-700 to-blue-700 p-5 text-white shadow-lg">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-100">
                  DR Sonucu
                </p>
                <p className="mt-3 text-3xl font-bold leading-tight">
                  {result.pytorch.label.replace("_", " ")}
                </p>
                <p className="mt-4 rounded-lg bg-white/15 px-3 py-2 text-sm font-medium">
                  Güven: {(result.pytorch.confidence * 100).toFixed(1)}%
                </p>
                <p className="mt-2 rounded-lg bg-white/10 px-3 py-2 text-xs font-medium text-cyan-100">
                  Ham Güven:{" "}
                  {(
                    (result.pytorch.rawConfidence ??
                      result.pytorch.confidence) * 100
                  ).toFixed(1)}
                  % | T={result.pytorch.temperature ?? "-"}
                </p>
              </div>

              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-800">
                  ODIR Risk Tahminleri
                </p>
                <div className="mt-3 space-y-2">
                  {result.odir.results.map((r: any, i: number) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm"
                    >
                      <span className="font-medium text-slate-800">
                        {r.label}
                      </span>
                      <span className="font-semibold text-emerald-700">
                        {(r.confidence * 100).toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {result.uncertainty || result.ood ? (
                <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-5 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-800">
                    Güvenilirlik Katmanı
                  </p>
                  <div className="mt-3 space-y-1 text-sm text-slate-700">
                    <p>
                      Predictive Entropy:{" "}
                      {Number(
                        result.uncertainty?.predictiveEntropy || 0,
                      ).toFixed(4)}
                    </p>
                    <p>
                      Mutual Information:{" "}
                      {Number(
                        result.uncertainty?.mutualInformation || 0,
                      ).toFixed(4)}
                    </p>
                    <p>
                      Sınıf Varyansı:{" "}
                      {Number(result.uncertainty?.classVariance || 0).toFixed(
                        6,
                      )}
                    </p>
                    <p>
                      OOD Skoru: %
                      {(Number(result.ood?.score || 0) * 100).toFixed(1)}
                    </p>
                    <p>
                      OOD Durumu:{" "}
                      {result.ood?.isOutOfDistribution
                        ? "Dağılım Dışı Şüpheli"
                        : "Dağılım İçi"}
                    </p>
                  </div>
                </div>
              ) : null}

              {result.localization ? (
                <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-5 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-indigo-800">
                    Localization Metrikleri
                  </p>
                  <div className="mt-3 space-y-1 text-sm text-slate-700">
                    <p>
                      IoU: {Number(result.localization.iou || 0).toFixed(4)}
                    </p>
                    <p>
                      Dice: {Number(result.localization.dice || 0).toFixed(4)}
                    </p>
                    <p>
                      Pointing Hit:{" "}
                      {result.localization.pointingHit ? "Evet" : "Hayır"}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="space-y-4">
              {result.heatmapPlus ? (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 shadow-sm">
                  <div className="border-b border-slate-800 bg-slate-900/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-cyan-200">
                    Grad-CAM++
                  </div>
                  <img
                    src={result.heatmapPlus}
                    alt="Grad-CAM Plus Plus Heatmap"
                    className="h-[280px] w-full object-contain md:h-[320px]"
                  />
                </div>
              ) : null}
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="border-t border-slate-200 bg-slate-50/70 px-4 pb-6 pt-5 md:px-6 md:pb-8">
        {!result ? (
          <Button
            className="h-13 w-full rounded-xl bg-cyan-700 text-base font-semibold text-white shadow-sm transition hover:bg-cyan-800"
            onClick={handleAnalyze}
            disabled={isLoading || !file}
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <Zap className="mr-2 h-5 w-5" />
            )}
            Analizi Başlat
          </Button>
        ) : (
          <div className="w-full space-y-5">
            <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 md:flex-row md:items-center md:justify-between md:p-5">
              <div className="flex items-center gap-3 text-slate-800">
                <ShieldCheck className="h-5 w-5 text-cyan-700" />
                <Label className="text-sm font-semibold uppercase tracking-[0.08em] md:text-base">
                  Yapay Zeka Sonucu Doğru mu?
                </Label>
              </div>
              <div className="flex gap-2">
                <Button
                  className={`rounded-xl px-6 text-sm font-semibold ${
                    isCorrect === true
                      ? "bg-emerald-600 text-white hover:bg-emerald-700"
                      : "border border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50"
                  }`}
                  onClick={() => setIsCorrect(true)}
                >
                  EVET
                </Button>
                <Button
                  className={`rounded-xl px-6 text-sm font-semibold ${
                    isCorrect === false
                      ? "bg-rose-600 text-white hover:bg-rose-700"
                      : "border border-rose-300 bg-white text-rose-700 hover:bg-rose-50"
                  }`}
                  onClick={() => setIsCorrect(false)}
                >
                  HAYIR
                </Button>
              </div>
            </div>

            {isCorrect === false && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-4">
                <Label className="mb-2 block text-sm font-semibold uppercase tracking-[0.08em] text-rose-700">
                  Düzeltme Seçimi
                </Label>
                <select
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium outline-none transition focus:border-cyan-500"
                  value={actualResult}
                  onChange={(e) => setActualResult(e.target.value)}
                >
                  <option value="">Doğru etiketi seçin...</option>
                  {[
                    "No_DR",
                    "Mild",
                    "Moderate",
                    "Severe",
                    "Proliferative_DR",
                  ].map((c) => (
                    <option key={c} value={c}>
                      {c.replace("_", " ")}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
                <Label className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-700">
                  Doktor Notları
                </Label>
                <Textarea
                  placeholder="Klinik gözlemlerinizi buraya girin..."
                  className="min-h-[120px] rounded-xl border-slate-300 bg-white text-base"
                  value={doctorNote}
                  onChange={(e) => setDoctorNote(e.target.value)}
                />
              </div>

              <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
                <Label className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-700">
                  Hastanın Kullanması Gereken İlaçlar
                </Label>
                <Textarea
                  placeholder="İlaç adını, dozunu ve kullanım süresini belirtin..."
                  className="min-h-[120px] rounded-xl border-slate-300 bg-white text-base"
                  value={ilaclar}
                  onChange={(e) => setIlaclar(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Button
                className="h-12 rounded-xl bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-700"
                onClick={handleFinalSave}
                disabled={
                  isLoading ||
                  isCorrect === null ||
                  (isCorrect === false && !actualResult)
                }
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <Save className="mr-2 h-5 w-5" />
                )}
                Kaydet
              </Button>

              <Button
                className="h-12 rounded-xl bg-slate-800 text-sm font-semibold text-white hover:bg-slate-900"
                onClick={handlePreviewPDF}
              >
                PDF Görüntüle
              </Button>
            </div>
          </div>
        )}
      </CardFooter>
    </Card>
  );
}
