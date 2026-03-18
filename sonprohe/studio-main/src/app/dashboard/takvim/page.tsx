import { redirect } from "next/navigation";
import { getCurrentDoctorSession } from "@/lib/auth-session";
import { CalendarBoard } from "@/components/dashboard/calendar-board";

export default async function TakvimPage() {
  const doctor = await getCurrentDoctorSession();
  if (!doctor) {
    redirect("/login");
  }

  return (
    <div className="clinic-app-bg min-h-[calc(100vh-6rem)] space-y-4 p-2 md:p-3">
      <div className="rounded-2xl border border-[#d8e0df] bg-white px-5 py-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5f90ad]">
          Klinik Takvim
        </p>
        <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
          Aylık Görev Planı
        </h1>
      </div>

      <CalendarBoard doctorId={doctor.id} />
    </div>
  );
}
