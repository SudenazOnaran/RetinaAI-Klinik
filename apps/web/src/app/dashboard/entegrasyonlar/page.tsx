import { redirect } from "next/navigation";
import { Link2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import IntegrationsClient from "@/components/dashboard/integrations-client";
import { getCurrentDoctorSession } from "@/lib/auth-session";
import { isRoleAllowed } from "@/lib/roles";
import { prisma } from "@/lib/prisma";

export default async function IntegrationsPage() {
  const session = await getCurrentDoctorSession();

  if (!session) {
    redirect("/login");
  }

  if (!isRoleAllowed(session.role, ["DOCTOR", "MANAGER"])) {
    redirect("/dashboard");
  }

  const patients = await prisma.patient.findMany({
    where: {
      doctorId: session.id,
    },
    select: {
      id: true,
      fullName: true,
      tcNo: true,
      risk: true,
      createdAt: true,
      analyses: {
        select: {
          id: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 300,
  });

  const serializedPatients = patients.map((patient) => ({
    id: patient.id,
    fullName: patient.fullName,
    tcNo: patient.tcNo,
    risk: patient.risk,
    createdAt: patient.createdAt.toISOString(),
    analysisCount: patient.analyses.length,
  }));

  return (
    <div className="clinic-app-bg min-h-screen p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-2xl border border-[#cfe0e8] bg-gradient-to-r from-[#eef6fb] via-white to-[#edf7f4] px-6 py-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5f90ad]">
            Ayarlar / Klinik Entegrasyon
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Klinik Entegrasyon Merkezi
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Hasta ve analiz verilerini HL7 FHIR veya HBYS API sistemlerine
            aktarın, gönderim loglarını takip edin.
          </p>
        </div>

        <Card className="overflow-hidden border border-[#d8e0df] bg-white shadow-sm">
          <CardHeader className="border-b border-[#deeaef] bg-[#f8fcff]">
            <CardTitle className="flex items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[#e6f0f7] text-[#4c7da5]">
                <Link2 className="h-5 w-5" />
              </span>
              Entegrasyon Aktarım İşlemleri
            </CardTitle>
            <CardDescription className="text-slate-600">
              FHIR için JSON Bundle, HBYS için klinik payload gönderimi yapılır.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 md:p-5">
            <IntegrationsClient patients={serializedPatients} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
