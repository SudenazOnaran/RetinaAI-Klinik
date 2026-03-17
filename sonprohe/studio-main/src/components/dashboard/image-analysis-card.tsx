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
import jsPDF from "jspdf";

export function ImageAnalysisCard({ patientId }: { patientId: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [base64Image, setBase64Image] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);
  const [doctorNote, setDoctorNote] = useState("");
  const [ilaclar, setIlaclar] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [actualResult, setActualResult] = useState("");
  const [drFeedback, setDrFeedback] = useState("");

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
      const finalResult =
        isCorrect === false ? actualResult : result.pytorch.label;

      await saveAnalysisAction({
        patientId,
        aiResult: finalResult,
        drFeedback: isCorrect === false ? actualResult : undefined, // 🔹 buraya ekledik
        aiOdriLabels: result.odir?.results.map((r: any) => r.label) || [],
        aiOdriConfidences:
          result.odir?.results.map((r: any) => r.confidence) || [],
        confidence: result.pytorch.confidence,
        heatmapUrl: result.heatmap,
        originalImage: base64Image || "",
        doctorNote,
        ilaclar,
      });

      toast({ title: "Başarılı", description: "Analiz kaydedildi." });

      setFile(null);
      setPreviewUrl(null);
      setBase64Image(null);
      setResult(null);
      setDoctorNote("");
      setIlaclar("");
      setIsCorrect(null);
      setActualResult("");
      setDrFeedback("");
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

  const handleDownloadPDF = () => {
    if (!result) return;
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("Retina Analiz Raporu", 14, 20);

    doc.setFontSize(12);
    doc.text(`AI Sonucu: ${result.pytorch.label}`, 14, 40);
    doc.text(`Güven: ${(result.pytorch.confidence * 100).toFixed(1)}%`, 14, 50);
    doc.text(
      `Risk Tahmini: ${result.tensorflow.labels[0] || "Sağlıklı"}`,
      14,
      60
    );
    doc.text(`Doktor Notu: ${doctorNote || "-"}`, 14, 70);
    doc.text(`İlaçlar: ${ilaclar || "-"}`, 14, 80);

    if (previewUrl) {
      doc.addImage(previewUrl, "JPEG", 14, 90, 180, 120);
    }

    if (result.heatmap) {
      doc.addImage(result.heatmap, "JPEG", 14, 210, 180, 120);
    }

    doc.save("rapor.pdf");
  };

  return (
    <Card className="w-full relative overflow-hidden bg-gradient-to-br from-white/80 via-blue-50 to-purple-50 shadow-2xl rounded-3xl border border-transparent animate-in fade-in zoom-in-95 duration-500">
      <CardHeader className="pb-2">
        <CardTitle className="text-3xl font-extrabold text-slate-900">
          GÖRÜNTÜ ANALİZİ
        </CardTitle>
        <CardDescription className="text-slate-700 font-semibold">
          Retina fundus verisini yapay zeka ile hızlıca değerlendirin.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-8 pt-6">
        {/* Dosya Yükleme */}
        {!previewUrl ? (
          <div className="group border-4 border-dashed border-blue-300 rounded-2xl p-16 text-center hover:bg-blue-100 cursor-pointer relative transition-all duration-500">
            <Upload className="mx-auto h-16 w-16 text-blue-400 group-hover:scale-110 transition-transform mb-4" />
            <p className="text-lg font-bold text-blue-600 uppercase">
              GÖRÜNTÜ YÜKLE
            </p>
            <input
              type="file"
              accept="image/*"
              className="absolute inset-0 opacity-0 cursor-pointer"
              onChange={handleFileChange}
            />
          </div>
        ) : (
          <div className="relative aspect-video bg-black rounded-2xl overflow-hidden border-2 border-blue-300 shadow-lg transition-transform hover:scale-[1.02] duration-500">
            <img
              src={previewUrl}
              alt="Preview"
              className="w-full h-full object-contain"
            />
            <Button
              variant="destructive"
              size="icon"
              className="absolute top-4 right-4 rounded-xl shadow-xl hover:scale-110 transition-transform"
              onClick={() => {
                setPreviewUrl(null);
                setBase64Image(null);
                setResult(null);
              }}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        )}

        {/* Kartlar ve Heatmap */}
        {result && (
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex flex-col gap-6 md:w-1/3">
              {/* Evre Kartı */}
              <div className="p-6 bg-gradient-to-br from-purple-500 to-pink-500 text-white rounded-3xl shadow-xl space-y-4 flex flex-col justify-center items-start transform hover:scale-[1.03] transition-transform relative overflow-hidden">
                <p className="text-lg font-bold tracking-wide">
                  Diyabetik Retinopati Evresi
                </p>
                <p className="text-3xl font-extrabold">
                  {result.pytorch.label.replace("_", " ")}
                </p>
                <p className="text-xl font-bold text-right">
                  Güven: {(result.pytorch.confidence * 100).toFixed(1)}%
                </p>
              </div>

              {/* Risk Tahmini Kartı */}
              <div className="p-6 bg-gradient-to-br from-green-400 to-teal-500 text-white rounded-3xl shadow-xl space-y-4">
                <p className="text-lg font-bold">ODIR Risk Tahminleri</p>

                <div className="space-y-2">
                  {result.odir.results.map((r: any, i: number) => (
                    <div
                      key={i}
                      className="flex justify-between bg-white/20 px-4 py-2 rounded-xl text-lg font-bold"
                    >
                      <span>{r.label}</span>
                      <span>{(r.confidence * 100).toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Heatmap */}
            <div className="relative md:w-2/3 h-[400px] bg-black rounded-3xl overflow-hidden shadow-xl transform hover:scale-[1.02] transition-transform flex items-center justify-center">
              <img
                src={result.heatmap}
                alt="Heatmap"
                className="w-full h-full object-contain opacity-90 hover:opacity-100 transition-opacity rounded-2xl"
              />
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex-col gap-6 pt-2 pb-10 px-4">
        {!result ? (
          <Button
            className="w-full h-16 rounded-2xl bg-gradient-to-r from-blue-500 to-green-500 hover:from-green-500 hover:to-green-400 text-white font-extrabold text-xl shadow-lg transition-all hover:scale-[1.02] flex items-center justify-center gap-3"
            onClick={handleAnalyze}
            disabled={isLoading || !file}
          >
            {isLoading ? (
              <Loader2 className="animate-spin h-6 w-6" />
            ) : (
              <Zap className="h-6 w-6" />
            )}
            Analizi Başlat
          </Button>
        ) : (
          <div className="w-full space-y-6 animate-in fade-in duration-500">
            {/* Onay Paneli */}
            <div className="flex flex-col md:flex-row items-center justify-between p-6 bg-white/90 border border-gray-200 rounded-2xl gap-4">
              <div className="flex items-center gap-3 text-slate-900">
                <ShieldCheck className="h-6 w-6" />
                <Label className="font-bold text-lg tracking-tight uppercase">
                  Yapay Zeka Sonucu Doğru mu?
                </Label>
              </div>
              <div className="flex gap-3">
                <Button
                  className={`rounded-2xl px-8 font-bold transition-all ${
                    isCorrect === true
                      ? "bg-green-500 hover:bg-green-600 text-white"
                      : "bg-white border border-green-500 hover:bg-green-100 text-green-600"
                  }`}
                  onClick={() => setIsCorrect(true)}
                >
                  EVET
                </Button>
                <Button
                  className={`rounded-2xl px-8 font-bold transition-all ${
                    isCorrect === false
                      ? "bg-red-500 hover:bg-red-600 text-white"
                      : "bg-white border border-red-500 hover:bg-red-100 text-red-600"
                  }`}
                  onClick={() => setIsCorrect(false)}
                >
                  HAYIR
                </Button>
              </div>
            </div>

            {isCorrect === false && (
              <div className="space-y-2">
                <Label className="text-sm font-bold text-red-500 uppercase tracking-wide">
                  Düzeltme Seçimi
                </Label>
                <select
                  className="w-full h-12 px-4 bg-white border-2 border-gray-300 rounded-2xl font-bold outline-none focus:border-blue-500 transition-all"
                  value={actualResult}
                  onChange={(e) => setActualResult(e.target.value)}
                >
                  <option value={drFeedback}>Doğru Etiketi Seçin...</option>
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

            {/* Doktor Notları */}
            <div className="space-y-2">
              <Label className="text-sm font-bold text-slate-600 uppercase tracking-wide">
                Doktor Notları
              </Label>
              <Textarea
                placeholder="Klinik gözlemlerinizi buraya girin..."
                className="min-h-[120px] rounded-2xl border-2 border-gray-300 bg-white/90 focus:bg-white transition-all text-lg font-medium"
                value={doctorNote}
                onChange={(e) => setDoctorNote(e.target.value)}
              />
            </div>

            {/* İlaçlar */}
            <div className="space-y-2">
              <Label className="text-sm font-bold text-slate-600 uppercase tracking-wide">
                Hastanın Kullanması Gereken İlaçlar
              </Label>
              <Textarea
                placeholder="Hastanın kullanması gereken ilaçları miktari ve süresini buraya girin..."
                className="min-h-[120px] rounded-2xl border-2 border-gray-300 bg-white/90 focus:bg-white transition-all text-lg font-medium"
                value={ilaclar}
                onChange={(e) => setIlaclar(e.target.value)}
              />
            </div>

            {/* Kaydet ve PDF */}
            <div className="flex gap-4 flex-col md:flex-row">
              <Button
                className="flex-1 h-16 rounded-2xl bg-gradient-to-r from-green-400 to-teal-500 hover:from-blue-500 hover:to-purple-500 text-white font-extrabold text-xl shadow-lg transition-all hover:scale-[1.02] flex items-center justify-center gap-3"
                onClick={handleFinalSave}
                disabled={
                  isLoading ||
                  isCorrect === null ||
                  (isCorrect === false && !actualResult)
                }
              >
                {isLoading ? (
                  <Loader2 className="animate-spin h-6 w-6" />
                ) : (
                  <Save className="h-6 w-6" />
                )}
                Kaydet
              </Button>

              <Button
                className="flex-1 h-16 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-extrabold text-xl shadow-lg transition-all hover:scale-[1.02]"
                onClick={handleDownloadPDF}
              >
                PDF İndir
              </Button>
            </div>
          </div>
        )}
      </CardFooter>
    </Card>
  );
}
