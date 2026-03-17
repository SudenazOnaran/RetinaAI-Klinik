import { prisma } from "@/lib/prisma";
import { getCurrentDoctorSession } from "@/lib/auth-session";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import HastalarClient from "./HastalarClient";
import { Card, CardContent } from "@/components/ui/card";
import { User, Activity, AlertTriangle, Plus } from "lucide-react";

export default async function HastalarPage() {
  const doctor = await getCurrentDoctorSession();
  if (!doctor) {
    redirect("/login");
  }

  // 🚀 VERİTABANI SORGULARI (Parallel Fetching)
  // Hem hasta listesini hem de toplam analiz sayısını aynı anda çekiyoruz.
  const [patients, totalAnalyses] = await Promise.all([
    prisma.patient.findMany({
      where: { doctorId: doctor.id },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { analyses: true },
        },
      },
    }),
    prisma.analysis.count({ where: { patient: { doctorId: doctor.id } } }),
  ]);

  // ⚠️ YÜKSEK RİSK HESAPLAMA
  // Dashboard ile tutarlı olması için sadece "Severe" ve "Proliferative_DR" olanları sayıyoruz.
  // Eğer tüm hastalıkları saymak istersen filter'ı değiştirebiliriz.
  const highRiskCount = patients.filter((p) =>
    ["Severe", "Proliferative_DR"].includes(p.risk || ""),
  ).length;

  return (
    <div className="clinic-app-bg min-h-screen p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-2xl border border-[#d8e0df] bg-white px-6 py-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5f90ad]">
                Hasta Yönetimi
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
                Hasta Yönetimi
              </h1>
              <p className="mt-2 text-sm text-slate-600 md:text-base">
                Kayıtlı hasta portföyü ve analiz yükü özeti.
              </p>
            </div>

            <Button
              asChild
              className="bg-[var(--retina-primary)] text-white hover:bg-[var(--retina-primary-deep)]"
            >
              <Link
                href="/dashboard/hastalar/yeni"
                className="flex items-center gap-2"
              >
                <Plus size={18} /> Yeni Hasta Kaydı
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <StatCard
            title="Toplam Hasta"
            value={patients.length}
            icon={<User className="h-5 w-5" />}
            color="blue"
            subText="Aktif Kayıt"
          />

          <StatCard
            title="Toplam Analizler"
            value={totalAnalyses}
            icon={<Activity className="h-5 w-5" />}
            color="emerald"
            subText="Tamamlanan İşlem"
          />

          <StatCard
            title="Yüksek Riskli"
            value={highRiskCount}
            icon={<AlertTriangle className="h-5 w-5" />}
            color="amber"
            subText="Acil İlgi Gereken"
          />
        </div>

        <div>
          <Card className="overflow-hidden border border-slate-200 bg-white shadow-sm">
            <CardContent className="p-0">
              <div className="p-6">
                <HastalarClient patients={patients} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color, subText }: any) {
  const iconBg: any = {
    blue: "bg-[#edf5ff] text-[var(--retina-primary)]",
    emerald: "bg-[#e7fbf8] text-[var(--retina-accent)]",
    amber: "bg-amber-100/80 text-amber-700",
  };

  return (
    <Card className="border border-slate-200 bg-white shadow-sm">
      <CardContent className="p-6 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
            {title}
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-800">
              {value}
            </span>
            <span className="text-[10px] font-bold text-slate-400 uppercase">
              {subText}
            </span>
          </div>
        </div>

        <div className={`p-3 rounded-xl ${iconBg[color]}`}>{icon}</div>
      </CardContent>
    </Card>
  );
}
