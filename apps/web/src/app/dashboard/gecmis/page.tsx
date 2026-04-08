import { redirect } from "next/navigation";
import { getCurrentDoctorSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import HistoryClient from "./history-client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { History } from "lucide-react";

export default async function HistoryPage() {
  const doctor = await getCurrentDoctorSession();
  if (!doctor) {
    redirect("/login");
  }

  const analyses = await prisma.analysis.findMany({
    where: {
      patient: {
        doctorId: doctor.id,
      },
    },
    select: {
      id: true,
      aiResult: true,
      drFeedback: true,
      confidence: true,
      doctorNote: true,
      createdAt: true,
      patient: {
        select: {
          id: true,
          fullName: true,
          tcNo: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const rows = analyses.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
  }));

  return (
    <div className="clinic-app-bg min-h-screen p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-2xl border border-[#d8e0df] bg-white px-6 py-5 shadow-sm">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Geçmiş Kayıtlar
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Klinik geçmiş kayıtları ve analiz arşivini filtreleyin, inceleyin ve
            dışa aktarın.
          </p>
        </div>

        <Card className="border border-[#d8e0df] bg-white shadow-sm">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-[#5f90ad]" />
              Geçmiş Arşivi
            </CardTitle>
            <CardDescription>
              Tanı, güven, not ve tarih kırılımında geçmiş analiz kayıtlarını
              yönetin.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <HistoryClient rows={rows} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
