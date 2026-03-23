import { redirect } from "next/navigation";
import { FlaskConical } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentDoctorSession } from "@/lib/auth-session";
import { isRoleAllowed } from "@/lib/roles";
import PilotMetricsClient from "@/components/dashboard/pilot-metrics-client";

export default async function PilotMetricsPage() {
  const session = await getCurrentDoctorSession();
  if (!session) {
    redirect("/login");
  }

  if (!isRoleAllowed(session.role, ["DOCTOR", "MANAGER", "AUDITOR"])) {
    redirect("/dashboard");
  }

  return (
    <div className="clinic-app-bg mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div className="rounded-2xl border border-[#d8e0df] bg-white px-6 py-5 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Prospektif Pilot Metrikleri
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Zaman kazanci, hata azalimi ve hasta basina sure metriklerini
          kaydederek klinik performans kanitini olusturun.
        </p>
      </div>

      <Card className="border border-[#d8e0df] bg-white shadow-sm">
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-[#5f90ad]" />
            Pilot Kanit Paneli
          </CardTitle>
          <CardDescription>
            Baslangic ve guncel degerleri kaydedin, iyilesme yuzdesini otomatik
            takip edin.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <PilotMetricsClient
            canWrite={isRoleAllowed(session.role, ["DOCTOR", "MANAGER"])}
          />
        </CardContent>
      </Card>
    </div>
  );
}
