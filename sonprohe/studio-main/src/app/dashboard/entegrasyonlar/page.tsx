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
    <div className="clinic-app-bg mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div className="rounded-2xl border border-[#d8e0df] bg-white px-6 py-5 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Klinik Entegrasyon Merkezi
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Hasta ve analiz verilerini HL7 FHIR veya HBYS API sistemlerine
          aktarın, gönderim loglarını takip edin.
        </p>
      </div>

      <Card className="border border-[#d8e0df] bg-white shadow-sm">
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-[#5f90ad]" />
            Entegrasyon Aktarım İşlemleri
          </CardTitle>
          <CardDescription>
            FHIR için JSON Bundle, HBYS için klinik payload gönderimi yapılır.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <IntegrationsClient patients={serializedPatients} />
        </CardContent>
      </Card>
    </div>
  );
}
