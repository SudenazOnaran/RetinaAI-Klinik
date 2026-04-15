import { ImageAnalysisCard } from "@/components/dashboard/image-analysis-card";
import { getRequestMessages } from "@/lib/i18n/server";

export default function AnalysisPage() {
  // Note: page is synchronous in current route tree; static messages are fetched at render boundary.
  return <AnalysisPageContent />;
}

async function AnalysisPageContent() {
  const messages = await getRequestMessages();
  const t = messages.analysisPage;
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {t.title}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          {t.description}
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
