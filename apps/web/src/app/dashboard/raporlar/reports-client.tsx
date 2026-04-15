"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Search,
  FileText,
  ChevronRight,
  Download,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/components/providers/i18n-provider";

type PatientReportSummary = {
  patientId: string;
  fullName: string;
  tcNo: string;
  reportCount: number;
  lastReportAt: string | null;
};

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

function toCsv(rows: PatientReportSummary[]) {
  const header = ["patientId", "hasta", "tc", "raporSayisi", "sonRaporTarihi"];
  const lines = rows.map((r) => [
    r.patientId,
    r.fullName,
    r.tcNo,
    String(r.reportCount),
    r.lastReportAt ? new Date(r.lastReportAt).toISOString() : "",
  ]);

  return [header, ...lines]
    .map((line) =>
      line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","),
    )
    .join("\n");
}

export default function ReportsClient({
  reports,
}: {
  reports: PatientReportSummary[];
}) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [minReportCount, setMinReportCount] = useState("1");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] =
    useState<(typeof PAGE_SIZE_OPTIONS)[number]>(10);

  const detailButtonClassName =
    "border-[var(--retina-secondary)] text-[var(--retina-secondary)] hover:bg-[var(--retina-secondary)] hover:text-white focus-visible:ring-[var(--retina-secondary)]";

  const resetButtonClassName =
    "h-10 w-full whitespace-nowrap border-[var(--retina-secondary)] text-[var(--retina-secondary)] hover:bg-[var(--retina-secondary)] hover:text-white focus-visible:ring-[var(--retina-secondary)] disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400 disabled:hover:bg-transparent disabled:hover:text-slate-400";

  const hasActiveFilters =
    search.trim().length > 0 ||
    minReportCount !== "1" ||
    fromDate.length > 0 ||
    toDate.length > 0;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const minCount = Math.max(1, Number(minReportCount) || 1);

    return reports.filter((r) => {
      const qOk =
        q.length === 0 ||
        r.fullName.toLowerCase().includes(q) ||
        r.tcNo.includes(q);

      const countOk = r.reportCount >= minCount;

      const fromOk =
        !fromDate ||
        (r.lastReportAt &&
          new Date(r.lastReportAt) >= new Date(`${fromDate}T00:00:00`));
      const toOk =
        !toDate ||
        (r.lastReportAt &&
          new Date(r.lastReportAt) <= new Date(`${toDate}T23:59:59`));

      return qOk && countOk && fromOk && toOk;
    });
  }, [reports, search, minReportCount, fromDate, toDate]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);

  const paged = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  const exportSelectedCsv = () => {
    if (filtered.length === 0) {
      toast({
        variant: "destructive",
        title: t("reportsFull.warnTitle"),
        description: t("reportsFull.warnEmptyExport"),
      });
      return;
    }

    const csv = toCsv(filtered);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `raporlar-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const resetFilters = () => {
    setSearch("");
    setMinReportCount("1");
    setFromDate("");
    setToDate("");
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-12">
          <div className="relative sm:col-span-2 xl:col-span-4">
            <label className="mb-1 block text-xs font-medium text-slate-600">
              {t("reportsFull.labelSearch")}
            </label>
            <Search className="absolute left-3 top-[34px] h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9"
              placeholder={t("reportsFull.placeholderSearch")}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div className="xl:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-600">
              {t("reportsFull.minReports")}
            </label>
            <Input
              type="number"
              min={1}
              value={minReportCount}
              onChange={(e) => {
                setMinReportCount(e.target.value);
                setPage(1);
              }}
              placeholder={t("reportsFull.minReportsPlaceholder")}
            />
          </div>

          <div className="xl:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-600">
              {t("reportsFull.dateFrom")}
            </label>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div className="xl:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-600">
              {t("reportsFull.dateTo")}
            </label>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div className="xl:col-span-2 flex items-end">
            <Button
              type="button"
              variant="outline"
              className={resetButtonClassName}
              onClick={resetFilters}
              disabled={!hasActiveFilters}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {t("reportsFull.resetFilters")}
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3">
          <span className="text-xs font-medium text-slate-600">
            {t("reportsFull.totalPatients", { count: filtered.length })}
          </span>
          <Button
            className="bg-[var(--retina-primary)] text-white hover:bg-[var(--retina-primary-deep)]"
            onClick={exportSelectedCsv}
          >
            <Download className="mr-2 h-4 w-4" /> {t("reportsFull.exportCsv")}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm">
          <span>{t("reportsFull.summaryTitle")}</span>
          <span>{t("reportsFull.totalResults", { count: filtered.length })}</span>
        </div>

        <table className="w-full text-sm">
          <thead className="bg-white border-b border-slate-200">
            <tr>
              <th className="p-3 text-left">{t("reportsFull.colPatient")}</th>
              <th className="p-3 text-left">{t("reportsFull.colTc")}</th>
              <th className="p-3 text-left">{t("reportsFull.colLastReport")}</th>
              <th className="p-3 text-left">{t("reportsFull.colReportCount")}</th>
              <th className="p-3 text-left">{t("reportsFull.colAction")}</th>
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-500">
                  {t("reportsFull.emptyRow")}
                </td>
              </tr>
            ) : (
              paged.map((row) => {
                return (
                  <tr
                    key={row.patientId}
                    className="border-b border-slate-100 hover:bg-slate-50"
                  >
                    <td className="p-3 font-medium text-slate-800">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-slate-400" />
                        {row.fullName}
                      </div>
                    </td>
                    <td className="p-3 text-slate-600">{row.tcNo}</td>
                    <td className="p-3 text-slate-600">
                      {row.lastReportAt
                        ? new Date(row.lastReportAt).toLocaleDateString("tr-TR")
                        : "-"}
                    </td>
                    <td className="p-3 text-slate-700 font-semibold">
                      {row.reportCount}
                    </td>
                    <td className="p-3">
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className={detailButtonClassName}
                      >
                        <Link
                          href={`/dashboard/hastalar/${row.patientId}?tab=reports`}
                        >
                          {t("reportsFull.detail")} <ChevronRight className="ml-1 h-4 w-4" />
                        </Link>
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 md:flex-row md:items-center md:justify-between">
        <div className="text-sm text-slate-600">
          {t("pagination.pageOf", { current: safePage, total: totalPages })}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600">{t("pagination.pageSize")}</span>
          <select
            className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
            value={pageSize}
            onChange={(e) => {
              setPageSize(
                Number(e.target.value) as (typeof PAGE_SIZE_OPTIONS)[number],
              );
              setPage(1);
            }}
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            {t("pagination.previous")}
          </Button>
          <Button
            variant="outline"
            disabled={safePage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            {t("pagination.next")}
          </Button>
        </div>
      </div>
    </div>
  );
}
