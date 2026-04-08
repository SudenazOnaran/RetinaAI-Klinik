import { ImageAnalysisCard } from "@/components/dashboard/image-analysis-card";

export default function AnalysisPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Görsel Yükle ve Analiz
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Fundus görüntüsünü yükleyin, analiz sonucunu klinik formatta
          değerlendirin.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mx-auto w-full max-w-2xl">
          <ImageAnalysisCard />
        </div>
      </div>
    </div>
  );
}
