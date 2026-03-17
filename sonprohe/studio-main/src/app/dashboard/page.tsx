import { prisma } from "@/lib/prisma";
import "@/app/globals.css";
import { getCurrentDoctorSession } from "@/lib/auth-session";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Activity,
  Users,
  AlertTriangle,
  Clock,
  UserPlus,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function DashboardPage() {
  const doctor = await getCurrentDoctorSession();
  if (!doctor) {
    redirect("/login");
  }

  const [totalPatients, totalAnalyses, highRiskPatients, recentPatients] =
    await Promise.all([
      prisma.patient.count({ where: { doctorId: doctor.id } }),
      prisma.analysis.count({ where: { patient: { doctorId: doctor.id } } }),
      prisma.patient.findMany({
        where: {
          doctorId: doctor.id,
          risk: { in: ["Severe", "Proliferative_DR"] },
        },
        take: 5,
        orderBy: { createdAt: "desc" },
      }),
      prisma.patient.findMany({
        where: { doctorId: doctor.id },
        take: 5,
        orderBy: { createdAt: "desc" },
      }),
    ]);

  const highRiskCount = await prisma.patient.count({
    where: {
      doctorId: doctor.id,
      risk: { in: ["Severe", "Proliferative_DR"] },
    },
  });

  const highRiskRate = totalPatients
    ? Math.round((highRiskCount / totalPatients) * 100)
    : 0;

  return (
    <div className="clinic-app-bg min-h-screen p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-2xl border border-[var(--retina-border)] bg-white px-6 py-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--retina-primary)]">
                Retina Klinik Destek Sistemi
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
                Klinik Özet - Dr. {doctor.name}
              </h1>
              <p className="mt-2 text-sm text-slate-600 md:text-base">
                Hoş geldiniz Dr. {doctor.name}. Size ait hasta portföyü, analiz
                yoğunluğu ve kritik risk dağılımı.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                asChild
                variant="outline"
                className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              >
                <Link href="/dashboard/hastalar">
                  <Users className="mr-2 h-4 w-4" /> Hastalar
                </Link>
              </Button>

              <Button
                asChild
                className="bg-[var(--retina-accent)] text-white hover:bg-[#00a592]"
              >
                <Link href="/dashboard/hastalar/yeni">
                  <UserPlus className="mr-2 h-4 w-4" /> Yeni Kayıt
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Toplam Hasta"
            value={totalPatients}
            icon={<Users className="h-5 w-5" />}
            color="cyan"
            desc="Kayıtlı portföy"
          />
          <StatsCard
            title="Yüksek Risk"
            value={highRiskCount}
            icon={<AlertTriangle className="h-5 w-5" />}
            color="amber"
            desc="Öncelikli takip"
          />
          <StatsCard
            title="Toplam Analiz"
            value={totalAnalyses}
            icon={<Activity className="h-5 w-5" />}
            color="teal"
            desc="Değerlendirme"
          />
          <StatsCard
            title="Sistem Durumu"
            value="Aktif"
            icon={<Clock className="h-5 w-5" />}
            color="slate"
            desc="Kesintisiz"
          />
        </section>

        <section className="grid gap-6 md:grid-cols-7">
          <Card className="md:col-span-4 border border-slate-200 bg-white shadow-sm">
            <CardHeader className="border-b border-slate-100">
              <CardTitle>Son Kaydedilen Hastalar</CardTitle>
              <CardDescription>Son güncellenen hasta kayıtları</CardDescription>
            </CardHeader>

            <CardContent className="space-y-3 pt-4">
              {recentPatients.map((patient) => (
                <div
                  key={patient.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#7eaec9] text-sm font-bold text-white">
                      {patient.fullName[0]}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {patient.fullName}
                      </p>
                      <p className="text-xs text-slate-500">
                        T.C: {patient.tcNo}
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                    className="text-slate-700"
                  >
                    <Link href={`/dashboard/hastalar/${patient.id}`}>
                      İncele <ChevronRight className="ml-1 h-3 w-3" />
                    </Link>
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="md:col-span-3 border border-amber-200/70 bg-white shadow-sm">
            <CardHeader className="border-b border-amber-100/70">
              <CardTitle className="flex items-center gap-2 text-slate-900">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                Kritik Risk İzleme
              </CardTitle>
              <CardDescription className="text-slate-600">
                Yüksek risk oranı: %{highRiskRate}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3 pt-4">
              {highRiskPatients.length > 0 ? (
                highRiskPatients.map((p) => (
                  <Link
                    key={p.id}
                    href={`/dashboard/hastalar/${p.id}`}
                    className="block rounded-lg border border-amber-200/80 bg-amber-50/60 px-3 py-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-900">
                        {p.fullName}
                      </span>
                      <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                        {p.risk}
                      </span>
                    </div>
                  </Link>
                ))
              ) : (
                <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">
                  Şu anda kritik vaka bulunmuyor.
                </p>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}

type StatsCardProps = {
  title: string;
  value: number | string;
  icon: any;
  color: "cyan" | "amber" | "teal" | "slate";
  desc: string;
};

function StatsCard({ title, value, icon, color, desc }: StatsCardProps) {
  const iconColors = {
    cyan: "bg-[#dceaf2] text-[#5f90ad]",
    amber: "bg-amber-100/80 text-amber-700",
    teal: "bg-[#d8ebe6] text-[#659f92]",
    slate: "bg-[#e9eeed] text-[#5b6f6b]",
  } as const;

  return (
    <Card className="border border-slate-200 bg-white shadow-sm">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className={`p-3 rounded-xl ${iconColors[color]}`}>{icon}</div>
        </div>

        <div className="mt-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
            {title}
          </p>
          <div className="flex items-baseline gap-2">
            <h2 className="text-3xl font-extrabold">{value}</h2>
            <span className="text-[10px] font-bold text-slate-500 uppercase">
              {desc}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
