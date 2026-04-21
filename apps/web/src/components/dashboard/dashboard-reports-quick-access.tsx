"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/components/providers/i18n-provider";
import { getDrStageIndexFromLabel } from "@/lib/dr-stage-labels";

type DashboardReportRow = {
  id: string;
  patientId: string;
  patientName: string;
  diagnosis: string;
  confidence: number;
  createdAt: string;
};

type Props = {
  reports: DashboardReportRow[];
};

type RiskFilter = "ALL" | "HIGH" | "MEDIUM" | "LOW";

function mapRiskBucket(diagnosis: string): RiskFilter {
  const idx = getDrStageIndexFromLabel(diagnosis);
  if (idx === null) return "LOW";
  if (idx >= 3) return "HIGH";
  if (idx === 2) return "MEDIUM";
  return "LOW";
}

export function DashboardReportsQuickAccess({ reports }: Props) {
  const { t, locale } = useTranslation();
  const [query, setQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("ALL");
  const [fromDate, setFromDate] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return reports.filter((row) => {
      const queryOk =
        q.length === 0 ||
        row.patientName.toLowerCase().includes(q) ||
        row.diagnosis.toLowerCase().includes(q);

      const riskOk =
        riskFilter === "ALL" || mapRiskBucket(row.diagnosis) === riskFilter;

      const created = new Date(row.createdAt);
      const dateOk = !fromDate || created >= new Date(`${fromDate}T00:00:00`);

      return queryOk && riskOk && dateOk;
    });
  }, [reports, query, riskFilter, fromDate]);

  return (
    <div className="space-y-3">
      <div className="grid gap-2 md:grid-cols-4">
        <Input
          placeholder={t("reportsQuick.searchPlaceholder")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <select
          className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
          value={riskFilter}
          onChange={(e) => setRiskFilter(e.target.value as RiskFilter)}
        >
          <option value="ALL">{t("reportsQuick.riskAll")}</option>
          <option value="HIGH">{t("reportsQuick.riskHigh")}</option>
          <option value="MEDIUM">{t("reportsQuick.riskMedium")}</option>
          <option value="LOW">{t("reportsQuick.riskLow")}</option>
        </select>

        <Input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
        />

        <Button asChild variant="outline">
          <Link href="/dashboard/raporlar">{t("reportsQuick.allReports")}</Link>
        </Button>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">
            {t("reportsQuick.empty")}
          </p>
        ) : (
          filtered.slice(0, 8).map((row) => (
            <Link
              key={row.id}
              href={`/dashboard/hastalar/${row.patientId}?tab=reports`}
              className="block rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 hover:bg-slate-100"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {row.patientName}
                  </p>
                  <p className="text-xs text-slate-500">
                    {new Date(row.createdAt).toLocaleDateString(
                      locale === "en" ? "en-US" : "tr-TR",
                    )}{" "}
                    | {t("reportsQuick.confidence")} %{Math.round((row.confidence || 0) * 100)}
                  </p>
                </div>
                <Badge variant="outline">{row.diagnosis}</Badge>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
