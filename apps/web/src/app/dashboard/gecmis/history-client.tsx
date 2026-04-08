"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type HistoryRow = {
  id: string;
  aiResult: string;
  drFeedback?: string | null;
  confidence: number;
  doctorNote?: string | null;
  createdAt: string;
  patient: {
    id: string;
    fullName: string;
    tcNo: string;
  };
};

type RiskFilter = "all" | "high" | "medium" | "low";
type NoteFilter = "all" | "with" | "without";
type SortKey = "createdAt_desc" | "createdAt_asc" | "confidence_desc";

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

function normalizeLabel(value?: string | null) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u");
}

function finalDiagnosis(row: HistoryRow) {
  return row.drFeedback || row.aiResult || "Belirtilmedi";
}

function riskBucket(row: HistoryRow): RiskFilter {
  const value = normalizeLabel(finalDiagnosis(row));
  if (
    ["severe", "proliferative_dr", "agir_evre", "cok_ileri_evre"].includes(
      value,
    )
  )
    return "high";
  if (["moderate", "orta", "orta_evre"].includes(value)) return "medium";
  return "low";
}

function riskBadge(label: string) {
  const value = normalizeLabel(label);

  if (["proliferative_dr", "cok_ileri_evre"].includes(value)) {
    return {
      text: "Çok Yüksek Risk",
      className: "bg-amber-100/80 text-amber-700 border-amber-200",
    };
  }

  if (["severe", "agir_evre"].includes(value)) {
    return {
      text: "Yüksek Risk",
      className: "bg-amber-100/80 text-amber-700 border-amber-200",
    };
  }

  if (["moderate", "orta", "orta_evre"].includes(value)) {
    return {
      text: "Orta Risk",
      className: "bg-[#efe7da] text-[#8b6a49] border-[#d9cab5]",
    };
  }

  return {
    text: "Düşük Risk",
    className: "bg-[#e8f2ef] text-[#5b8d82] border-[#cfe0dc]",
  };
}

function toCsv(rows: HistoryRow[]) {
  const header = [
    "analizId",
    "hastaId",
    "hastaAdi",
    "tcNo",
    "aiSonucu",
    "doktorGeriBildirimi",
    "finalTani",
    "guvenYuzde",
    "doktorNotu",
    "tarih",
  ];

  const lines = rows.map((row) => [
    row.id,
    row.patient.id,
    row.patient.fullName,
    row.patient.tcNo,
    row.aiResult || "",
    row.drFeedback || "",
    finalDiagnosis(row),
    Math.round(Number(row.confidence || 0) * 100).toString(),
    row.doctorNote || "",
    new Date(row.createdAt).toISOString(),
  ]);

  return [header, ...lines]
    .map((line) =>
      line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","),
    )
    .join("\n");
}

export default function HistoryClient({ rows }: { rows: HistoryRow[] }) {
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all");
  const [noteFilter, setNoteFilter] = useState<NoteFilter>("all");
  const [minConfidence, setMinConfidence] = useState("0");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sort, setSort] = useState<SortKey>("createdAt_desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] =
    useState<(typeof PAGE_SIZE_OPTIONS)[number]>(10);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const min = Math.max(0, Math.min(100, Number(minConfidence) || 0)) / 100;

    const byFilter = rows.filter((row) => {
      const qOk =
        query.length === 0 ||
        row.patient.fullName.toLowerCase().includes(query) ||
        row.patient.tcNo.includes(query) ||
        row.aiResult.toLowerCase().includes(query) ||
        String(row.drFeedback || "")
          .toLowerCase()
          .includes(query) ||
        String(row.doctorNote || "")
          .toLowerCase()
          .includes(query);

      const riskOk = riskFilter === "all" || riskBucket(row) === riskFilter;

      const note = String(row.doctorNote || "").trim();
      const noteOk =
        noteFilter === "all" ||
        (noteFilter === "with" && note.length > 0) ||
        (noteFilter === "without" && note.length === 0);

      const confidenceOk = Number(row.confidence || 0) >= min;

      const rowDate = new Date(row.createdAt);
      const fromOk = !fromDate || rowDate >= new Date(`${fromDate}T00:00:00`);
      const toOk = !toDate || rowDate <= new Date(`${toDate}T23:59:59`);

      return qOk && riskOk && noteOk && confidenceOk && fromOk && toOk;
    });

    return byFilter.sort((a, b) => {
      if (sort === "createdAt_desc") {
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      }
      if (sort === "createdAt_asc") {
        return (
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      }
      return Number(b.confidence || 0) - Number(a.confidence || 0);
    });
  }, [
    rows,
    search,
    riskFilter,
    noteFilter,
    minConfidence,
    fromDate,
    toDate,
    sort,
  ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);

  const paged = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  const exportCsv = () => {
    if (filtered.length === 0) return;
    const csv = toCsv(filtered);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gecmis-arsiv-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 lg:grid-cols-6">
        <div className="relative lg:col-span-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Hasta, TC, tanı veya not ara"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <select
          className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
          value={riskFilter}
          onChange={(e) => {
            setRiskFilter(e.target.value as RiskFilter);
            setPage(1);
          }}
        >
          <option value="all">Tüm risk grupları</option>
          <option value="high">Yüksek risk</option>
          <option value="medium">Orta risk</option>
          <option value="low">Düşük risk</option>
        </select>

        <select
          className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
          value={noteFilter}
          onChange={(e) => {
            setNoteFilter(e.target.value as NoteFilter);
            setPage(1);
          }}
        >
          <option value="all">Tüm not durumları</option>
          <option value="with">Not girilmiş</option>
          <option value="without">Not girilmemiş</option>
        </select>

        <Input
          type="number"
          min={0}
          max={100}
          value={minConfidence}
          onChange={(e) => {
            setMinConfidence(e.target.value);
            setPage(1);
          }}
          placeholder="Minimum güven %"
        />

        <Input
          type="date"
          value={fromDate}
          onChange={(e) => {
            setFromDate(e.target.value);
            setPage(1);
          }}
        />

        <Input
          type="date"
          value={toDate}
          onChange={(e) => {
            setToDate(e.target.value);
            setPage(1);
          }}
        />

        <select
          className="h-10 lg:col-span-2 rounded-md border border-slate-300 bg-white px-3 text-sm"
          value={sort}
          onChange={(e) => {
            setSort(e.target.value as SortKey);
            setPage(1);
          }}
        >
          <option value="createdAt_desc">En yeni kayıtlar</option>
          <option value="createdAt_asc">En eski kayıtlar</option>
          <option value="confidence_desc">Güveni en yüksekten</option>
        </select>

        <div className="lg:col-span-4 flex items-center justify-between gap-2">
          <span className="text-sm text-slate-600">
            Toplam sonuç: {filtered.length}
          </span>
          <Button
            variant="outline"
            onClick={exportCsv}
            disabled={filtered.length === 0}
          >
            <Download className="mr-2 h-4 w-4" /> Filtreyi CSV indir
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="p-3 text-left">Hasta</th>
              <th className="p-3 text-left">Final Tanı</th>
              <th className="p-3 text-left">Güven</th>
              <th className="p-3 text-left">Not</th>
              <th className="p-3 text-left">Tarih</th>
              <th className="p-3 text-right">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-500">
                  Filtrelere uygun geçmiş kayıt bulunamadı.
                </td>
              </tr>
            ) : (
              paged.map((row) => {
                const diagnosis = finalDiagnosis(row);
                const badge = riskBadge(diagnosis);
                return (
                  <tr
                    key={row.id}
                    className="border-b border-slate-100 hover:bg-slate-50"
                  >
                    <td className="p-3">
                      <div className="font-medium text-slate-800">
                        {row.patient.fullName}
                      </div>
                      <div className="text-xs text-slate-500">
                        TC: {row.patient.tcNo}
                      </div>
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className={badge.className}>
                        {badge.text}
                      </Badge>
                      <div className="mt-1 text-xs text-slate-500">
                        {diagnosis}
                      </div>
                    </td>
                    <td className="p-3">
                      %{Math.round(Number(row.confidence || 0) * 100)}
                    </td>
                    <td className="p-3 text-slate-600 max-w-[280px] truncate">
                      {row.doctorNote?.trim() || "-"}
                    </td>
                    <td className="p-3 text-slate-500">
                      {new Date(row.createdAt).toLocaleDateString("tr-TR")}
                    </td>
                    <td className="p-3 text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/dashboard/hastalar/${row.patient.id}`}>
                          Hasta Detayı
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
          Sayfa {safePage} / {totalPages}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600">Sayfa boyutu</span>
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
            Önceki
          </Button>
          <Button
            variant="outline"
            disabled={safePage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Sonraki
          </Button>
        </div>
      </div>
    </div>
  );
}
