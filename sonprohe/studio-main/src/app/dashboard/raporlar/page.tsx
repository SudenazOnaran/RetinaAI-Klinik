import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, FolderOpen } from "lucide-react";

export default function ReportsPage() {
  return (
    <div className="clinic-app-bg mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <div className="rounded-2xl border border-[#d8e0df] bg-white px-6 py-5 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Rapor Merkezi
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Hasta analiz raporlarını, doktor notlarını ve PDF çıktılarını bu
          bölümde yönetin.
        </p>
      </div>

      <Card className="border border-[#d8e0df] bg-white shadow-sm">
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-[#5f90ad]" />
            Klinik Raporlar
          </CardTitle>
          <CardDescription>
            Mevcut raporlama modülü sade klinik akışa göre yeniden
            yapılandırılıyor.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 pt-4">
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Raporları hasta bazında görüntülemek için Hasta Yönetimi ekranını
            kullanabilirsiniz.
          </p>

          <Button
            asChild
            className="bg-[#659f92] text-white hover:bg-[#84b9ad]"
          >
            <Link
              href="/dashboard/hastalar"
              className="inline-flex items-center gap-2"
            >
              <FolderOpen className="h-4 w-4" /> Hastalara Git
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
