import { redirect } from "next/navigation";
import { getCurrentDoctorSession } from "@/lib/auth-session";
import { CalendarBoard } from "@/components/dashboard/calendar-board";
import { getRequestMessages } from "@/lib/i18n/server";

export default async function TakvimPage() {
  const messages = await getRequestMessages();
  const t = messages.calendarPage;
  const doctor = await getCurrentDoctorSession();
  if (!doctor) {
    redirect("/login");
  }

  return (
    <div className="clinic-app-bg min-h-screen p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-2xl border border-[#d8e0df] bg-white px-6 py-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5f90ad]">
            {t.eyebrow}
          </p>
          <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
            {t.title}
          </h1>
        </div>

        <CalendarBoard doctorId={doctor.id} />
      </div>
    </div>
  );
}
