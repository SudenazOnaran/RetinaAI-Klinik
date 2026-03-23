import { redirect } from "next/navigation";
import { getCurrentDoctorSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import ReportsClient from "./reports-client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { FileText } from "lucide-react";

export default async function ReportsPage() {
  const doctor = await getCurrentDoctorSession();
  if (!doctor) {
    redirect("/login");
  }

  const patientsWithReports = await prisma.patient.findMany({
    where: {
      doctorId: doctor.id,
      analyses: { some: {} },
    },
    select: {
      id: true,
      fullName: true,
      tcNo: true,
      _count: {
        select: {
          analyses: true,
        },
      },
      analyses: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          createdAt: true,
        },
      },
    },
    orderBy: {
      fullName: "asc",
    },
  });

  const serializedReports = patientsWithReports.map((row) => ({
    patientId: row.id,
    fullName: row.fullName,
    tcNo: row.tcNo,
    reportCount: row._count.analyses,
    lastReportAt: row.analyses[0]?.createdAt
      ? row.analyses[0].createdAt.toISOString()
      : null,
  }));

  return (
    <div className="clinic-app-bg mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <div className="rounded-2xl border border-[#d8e0df] bg-white px-6 py-5 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Rapor Merkezi
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Bu sayfada tüm hastaların genel rapor özetini görüntüleyebilir, detay
          butonuyla ilgili hastanın rapor geçmişine geçebilirsiniz.
        </p>
      </div>

      <Card className="border border-[#d8e0df] bg-white shadow-sm">
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-[#5f90ad]" />
            Genel Hasta Raporları
          </CardTitle>
          <CardDescription>
            Gelişmiş filtreleme ve sayfalama ile hasta bazlı rapor yönetimi.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 pt-4">
          <ReportsClient reports={serializedReports} />
        </CardContent>
      </Card>
    </div>
  );
}
