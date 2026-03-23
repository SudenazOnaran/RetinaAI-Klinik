import { redirect } from "next/navigation";
import { Activity } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import MonitoringClient from "@/components/dashboard/monitoring-client";
import { getCurrentDoctorSession } from "@/lib/auth-session";
import { isRoleAllowed } from "@/lib/roles";

export default async function MonitoringPage() {
  const session = await getCurrentDoctorSession();
  if (!session) {
    redirect("/login");
  }

  if (!isRoleAllowed(session.role, ["MANAGER", "AUDITOR"])) {
    redirect("/dashboard");
  }

  return (
    <div className="clinic-app-bg mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div className="rounded-2xl border border-[#d8e0df] bg-white px-6 py-5 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Sistem Izleme ve Alarmlar
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Canli saglik kontrolu, kritik alarm kayitlari ve hata trendlerini bu
          ekrandan takip edin.
        </p>
      </div>

      <Card className="border border-[#d8e0df] bg-white shadow-sm">
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-[#5f90ad]" />
            Izleme Merkezi
          </CardTitle>
          <CardDescription>
            AI gateway ve entegrasyon kaynakli operasyonel alarm listesi.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <MonitoringClient />
        </CardContent>
      </Card>
    </div>
  );
}
