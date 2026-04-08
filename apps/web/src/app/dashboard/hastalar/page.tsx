import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getCurrentDoctorSession } from "@/lib/auth-session";
import { redirect } from "next/navigation";
import HastalarClient from "./HastalarClient";
import { Card, CardContent } from "@/components/ui/card";
import { User, Activity, AlertTriangle } from "lucide-react";
import { isHighRiskLabel } from "@/lib/risk-alerts";

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
type RiskFilter = "all" | "high" | "medium" | "low" | "none";
type AnalysisFilter = "all" | "none" | "1-3" | "4+";
type SortKey =
  | "createdAt_desc"
  | "createdAt_asc"
  | "fullName_asc"
  | "fullName_desc"
  | "analysis_desc";

function getSingleParam(
  value: string | string[] | undefined,
  fallback = "",
): string {
  if (Array.isArray(value)) return value[0] || fallback;
  return value || fallback;
}

function parsePage(value: string, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.floor(parsed));
}

function parsePageSize(value: string) {
  const parsed = Number(value) as (typeof PAGE_SIZE_OPTIONS)[number];
  return PAGE_SIZE_OPTIONS.includes(parsed) ? parsed : 10;
}

export default async function HastalarPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const doctor = await getCurrentDoctorSession();
  if (!doctor) {
    redirect("/login");
  }

  const params = (await searchParams) || {};

  const search = getSingleParam(params.search).trim();
  const riskFilter = (getSingleParam(params.risk, "all") ||
    "all") as RiskFilter;
  const analysisFilter = (getSingleParam(params.analysis, "all") ||
    "all") as AnalysisFilter;
  const dateFrom = getSingleParam(params.dateFrom);
  const dateTo = getSingleParam(params.dateTo);
  const sort = (getSingleParam(params.sort, "createdAt_desc") ||
    "createdAt_desc") as SortKey;
  const page = parsePage(getSingleParam(params.page, "1"), 1);
  const pageSize = parsePageSize(getSingleParam(params.pageSize, "10"));

  const validRiskFilters: RiskFilter[] = [
    "all",
    "high",
    "medium",
    "low",
    "none",
  ];
  const safeRiskFilter = validRiskFilters.includes(riskFilter)
    ? riskFilter
    : "all";

  const validAnalysisFilters: AnalysisFilter[] = ["all", "none", "1-3", "4+"];
  const safeAnalysisFilter = validAnalysisFilters.includes(analysisFilter)
    ? analysisFilter
    : "all";

  const validSorts: SortKey[] = [
    "createdAt_desc",
    "createdAt_asc",
    "fullName_asc",
    "fullName_desc",
    "analysis_desc",
  ];
  const safeSort = validSorts.includes(sort) ? sort : "createdAt_desc";

  const whereClauses: Prisma.Sql[] = [Prisma.sql`pb."doctorId" = ${doctor.id}`];

  if (search) {
    whereClauses.push(
      Prisma.sql`(
        pb."fullName" ILIKE ${`%${search}%`}
        OR pb."tcNo" ILIKE ${`%${search}%`}
      )`,
    );
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) {
    whereClauses.push(
      Prisma.sql`pb."createdAt" >= ${new Date(`${dateFrom}T00:00:00`)}`,
    );
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
    whereClauses.push(
      Prisma.sql`pb."createdAt" <= ${new Date(`${dateTo}T23:59:59`)}`,
    );
  }

  if (safeAnalysisFilter === "none") {
    whereClauses.push(Prisma.sql`pb."analysisCount" = 0`);
  }

  if (safeAnalysisFilter === "1-3") {
    whereClauses.push(Prisma.sql`pb."analysisCount" BETWEEN 1 AND 3`);
  }

  if (safeAnalysisFilter === "4+") {
    whereClauses.push(Prisma.sql`pb."analysisCount" >= 4`);
  }

  if (safeRiskFilter === "none") {
    whereClauses.push(
      Prisma.sql`(
        pb."analysisCount" = 0
        OR pb."normalizedRisk" IN ('', 'yok', 'analiz_yapilmadi', 'analiz_bekliyor')
      )`,
    );
  }

  if (safeRiskFilter === "high") {
    whereClauses.push(
      Prisma.sql`pb."normalizedRisk" IN ('severe', 'proliferative_dr', 'agir_evre', 'cok_ileri_evre', 'yuksek_risk', 'kritik_risk')`,
    );
  }

  if (safeRiskFilter === "medium") {
    whereClauses.push(
      Prisma.sql`pb."normalizedRisk" IN ('moderate', 'orta_evre', 'orta', 'orta_risk')`,
    );
  }

  if (safeRiskFilter === "low") {
    whereClauses.push(
      Prisma.sql`pb."normalizedRisk" IN ('mild', 'hafif_evre', 'healthy', 'saglikli', 'no_dr', 'dusuk_risk')`,
    );
  }

  const whereSql = Prisma.sql`${Prisma.join(whereClauses, " AND ")}`;

  const orderSql =
    safeSort === "createdAt_asc"
      ? Prisma.sql`pb."createdAt" ASC`
      : safeSort === "fullName_asc"
        ? Prisma.sql`pb."fullName" ASC`
        : safeSort === "fullName_desc"
          ? Prisma.sql`pb."fullName" DESC`
          : safeSort === "analysis_desc"
            ? Prisma.sql`pb."analysisCount" DESC, pb."createdAt" DESC`
            : Prisma.sql`pb."createdAt" DESC`;

  const offset = (page - 1) * pageSize;

  const commonPatientsCte = Prisma.sql`
    WITH patient_base AS (
      SELECT
        p."id",
        p."doctorId",
        p."fullName",
        p."tcNo",
        p."createdAt",
        p."risk",
        COUNT(a."id")::int AS "analysisCount",
        MAX(a."createdAt") AS "latestAnalysisAt",
        (
          ARRAY_REMOVE(
            ARRAY_AGG(a."drFeedback" ORDER BY a."createdAt" DESC),
            NULL
          )
        )[1] AS "latestDrFeedback",
        (
          ARRAY_REMOVE(
            ARRAY_AGG(a."aiResult" ORDER BY a."createdAt" DESC),
            NULL
          )
        )[1] AS "latestAiResult",
        (
          ARRAY_REMOVE(
            ARRAY_AGG(a."confidence" ORDER BY a."createdAt" DESC),
            NULL
          )
        )[1] AS "latestConfidence"
      FROM "Patient" p
      LEFT JOIN "Analysis" a ON a."patientId" = p."id"
      GROUP BY p."id"
    ),
    patient_enriched AS (
      SELECT
        pb."id",
        pb."doctorId",
        pb."fullName",
        pb."tcNo",
        pb."createdAt",
        pb."analysisCount",
        pb."latestAnalysisAt",
        pb."latestConfidence",
        COALESCE(
          NULLIF(pb."latestDrFeedback", 'null'),
          NULLIF(pb."latestAiResult", 'null'),
          NULLIF(pb."risk", ''),
          'Yok'
        ) AS "effectiveRisk",
        REPLACE(
          TRANSLATE(
            LOWER(
              COALESCE(
                NULLIF(pb."latestDrFeedback", 'null'),
                NULLIF(pb."latestAiResult", 'null'),
                NULLIF(pb."risk", ''),
                'Yok'
              )
            ),
            'çğıöşüı',
            'cgiosui'
          ),
          ' ',
          '_'
        ) AS "normalizedRisk"
      FROM patient_base pb
    )
  `;

  const [totalPatients, riskRows, totalAnalyses, totalFilteredRows, patients] =
    await Promise.all([
      prisma.patient.count({ where: { doctorId: doctor.id } }),
      prisma.patient.findMany({
        where: { doctorId: doctor.id },
        select: { risk: true },
      }),
      prisma.analysis.count({ where: { patient: { doctorId: doctor.id } } }),
      prisma.$queryRaw<Array<{ total: number }>>`
        ${commonPatientsCte}
        SELECT COUNT(*)::int as "total"
        FROM patient_enriched pb
        WHERE ${whereSql}
      `,
      prisma.$queryRaw<
        Array<{
          id: string;
          fullName: string;
          tcNo: string;
          createdAt: Date;
          analysisCount: number;
          latestAnalysisAt: Date | null;
          latestConfidence: number | null;
          effectiveRisk: string;
        }>
      >`
        ${commonPatientsCte}
        SELECT
          pb."id",
          pb."fullName",
          pb."tcNo",
          pb."createdAt",
          pb."analysisCount",
          pb."latestAnalysisAt",
          pb."latestConfidence",
          pb."effectiveRisk"
        FROM patient_enriched pb
        WHERE ${whereSql}
        ORDER BY ${orderSql}
        OFFSET ${offset}
        LIMIT ${pageSize}
      `,
    ]);

  const totalFiltered = totalFilteredRows[0]?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const safePage = Math.min(page, totalPages);

  // Ortak risk sınıflandırıcısı ile hesaplanır (Severe, Proliferative_DR, Ağır Evre, Çok İleri Evre vb.)
  const highRiskCount = riskRows.filter((p) => isHighRiskLabel(p.risk)).length;

  const serializedPatients = patients.map((patient) => ({
    id: patient.id,
    fullName: patient.fullName,
    tcNo: patient.tcNo,
    createdAt: patient.createdAt.toISOString(),
    latestAnalysisAt: patient.latestAnalysisAt?.toISOString() ?? null,
    latestConfidence:
      patient.latestConfidence === null
        ? null
        : Number(patient.latestConfidence),
    _count: { analyses: Number(patient.analysisCount || 0) },
    aiResult: patient.effectiveRisk,
    drFeedback: patient.effectiveRisk,
    risk: patient.effectiveRisk,
  }));

  return (
    <div className="clinic-app-bg min-h-screen p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-2xl border border-[#d8e0df] bg-white px-6 py-5 shadow-sm">
          <div className="flex flex-col gap-4">
            <div>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
                Hasta Yönetimi
              </h1>
              <p className="mt-2 text-sm text-slate-600 md:text-base">
                Hasta portföyünüz ve analiz yükünüzün güncel özetini buradan
                takip edebilirsiniz
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <StatCard
            title="Toplam Hasta"
            value={totalPatients}
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
                <HastalarClient
                  patients={serializedPatients}
                  totalFiltered={totalFiltered}
                  page={safePage}
                  totalPages={totalPages}
                  pageSize={pageSize}
                  initialFilters={{
                    search,
                    riskFilter: safeRiskFilter,
                    analysisFilter: safeAnalysisFilter,
                    dateFrom,
                    dateTo,
                    sort: safeSort,
                  }}
                />
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
            <span className="text-[10px] font-bold text-slate-500 uppercase">
              {subText}
            </span>
          </div>
        </div>

        <div className={`p-3 rounded-xl ${iconBg[color]}`}>{icon}</div>
      </CardContent>
    </Card>
  );
}
