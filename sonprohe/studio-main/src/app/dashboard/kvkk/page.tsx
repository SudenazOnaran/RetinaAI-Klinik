import { redirect } from "next/navigation";
import { getCurrentDoctorSession } from "@/lib/auth-session";
import { isRoleAllowed } from "@/lib/roles";
import { ShieldCheck } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import KvkkClient from "./kvkk-client";

export default async function KvkkPage() {
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
          KVKK Uyum Merkezi
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Açık rıza kayıtları, veri işleme logları ve anonimleştirme işlemleri.
        </p>
      </div>

      <Card className="border border-[#d8e0df] bg-white shadow-sm">
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-[#5f90ad]" />
            KVKK İşlemleri
          </CardTitle>
          <CardDescription>
            Açık rıza versiyonunu güncelleyin, gerektiğinde kayıtları
            anonimleştirin ve tüm işleme kayıtlarını takip edin.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <KvkkClient role={session.role} />
        </CardContent>
      </Card>
    </div>
  );
}
