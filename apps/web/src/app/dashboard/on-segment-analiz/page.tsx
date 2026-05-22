import { redirect } from "next/navigation";
import { getCurrentDoctorSession } from "@/lib/auth-session";
import { AnteriorSegmentPageClient } from "@/components/dashboard/anterior-segment-page-client";
import { listAnteriorSegmentReportsAction } from "@/app/actions/save-anterior-segment-report";
import { getRequestMessages } from "@/lib/i18n/server";

export default function AnteriorSegmentAnalysisPage() {
  return <AnteriorSegmentAnalysisPageContent />;
}

async function AnteriorSegmentAnalysisPageContent() {
  const messages = await getRequestMessages();
  const t = messages.anteriorSegmentPage;
  const doctor = await getCurrentDoctorSession();
  if (!doctor) {
    redirect("/login");
  }

  const listRes = await listAnteriorSegmentReportsAction();
  const initialReports = listRes.ok ? listRes.reports : [];

  return (
    <div className="clinic-app-bg min-h-screen p-4 md:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-2xl border border-[#d8e0df] bg-white px-6 py-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5f90ad]">
            {t.eyebrow}
          </p>
          <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
            {t.title}
          </h1>
          <p className="mt-2 text-sm text-slate-600">{t.description}</p>
        </div>

        <AnteriorSegmentPageClient initialReports={initialReports} />
      </div>
    </div>
  );
}
