"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search,
  ChevronRight,
  Trash2,
  RefreshCw,
  FileText,
  Plus,
  ArrowUpRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { bulkDeletePatientsAction } from "@/app/actions/bulk-delete-patients";
import { bulkUpdatePatientRiskAction } from "@/app/actions/bulk-update-patient-risk";

type Patient = {
  id: string;
  fullName: string;
  tcNo: string;
  createdAt: string;
  latestAnalysisAt?: string | null;
  latestConfidence?: number | null;
  risk?: string;
  aiResult?: string;
  drFeedback?: string | (string | null)[];
  _count?: {
    analyses?: number;
  };
};

type RiskFilter = "all" | "high" | "medium" | "low" | "none";
type AnalysisFilter = "all" | "none" | "1-3" | "4+";
type SortKey =
  | "createdAt_desc"
  | "createdAt_asc"
  | "fullName_asc"
  | "fullName_desc"
  | "analysis_desc";

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
const DEFAULT_FILTERS = {
  search: "",
  riskFilter: "all" as RiskFilter,
  analysisFilter: "all" as AnalysisFilter,
  dateFrom: "",
  dateTo: "",
  sort: "createdAt_desc" as SortKey,
};

function normalizeRisk(value?: string) {
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

function getEffectiveRisk(patient: Patient): string {
  const analysesCount = Number(patient._count?.analyses || 0);
  if (analysesCount === 0) {
    return "Analiz Yapılmadı";
  }

  const feedback = patient.drFeedback;
  const cleanFeedback = Array.isArray(feedback)
    ? feedback.find((v) => v && v !== "null")
    : feedback && feedback !== "null"
      ? feedback
      : undefined;

  return cleanFeedback || patient.aiResult || patient.risk || "Yok";
}

function getRiskStyle(risk: string) {
  const normalized = normalizeRisk(risk);

  if (["analiz_yapilmadi", "analiz_bekliyor"].includes(normalized)) {
    return {
      label: "ANALİZ YAPILMADI",
      className: "bg-slate-100 text-slate-600 border-slate-200",
    };
  }

  if (["proliferative_dr", "cok_ileri_evre"].includes(normalized)) {
    return {
      label: "ÇOK YÜKSEK RİSK",
      className: "bg-amber-100/80 text-amber-700 border-amber-200",
    };
  }

  if (["agir_evre", "severe"].includes(normalized)) {
    return {
      label: "YÜKSEK RİSK",
      className: "bg-amber-100/80 text-amber-700 border-amber-200",
    };
  }

  if (["kritik_risk"].includes(normalized)) {
    return {
      label: "ÇOK YÜKSEK RİSK",
      className: "bg-amber-100/80 text-amber-700 border-amber-200",
    };
  }

  if (["yuksek_risk"].includes(normalized)) {
    return {
      label: "YÜKSEK RİSK",
      className: "bg-amber-100/80 text-amber-700 border-amber-200",
    };
  }

  if (["moderate", "orta_evre", "orta"].includes(normalized)) {
    return {
      label: "ORTA RİSK",
      className: "bg-[#efe7da] text-[#8b6a49] border-[#d9cab5]",
    };
  }

  if (["orta_risk"].includes(normalized)) {
    return {
      label: "ORTA RİSK",
      className: "bg-[#efe7da] text-[#8b6a49] border-[#d9cab5]",
    };
  }

  if (["mild", "hafif_evre"].includes(normalized)) {
    return {
      label: "DÜŞÜK RİSK",
      className: "bg-[#e8f2ef] text-[#5b8d82] border-[#cfe0dc]",
    };
  }

  if (["dusuk_risk"].includes(normalized)) {
    return {
      label: "DÜŞÜK RİSK",
      className: "bg-[#e8f2ef] text-[#5b8d82] border-[#cfe0dc]",
    };
  }

  if (["no_dr", "healthy", "saglikli", "yok"].includes(normalized)) {
    return {
      label: "SAĞLIKLI",
      className: "bg-[#dff0ea] text-[#4c8a7d] border-[#c5ddd6]",
    };
  }

  return {
    label: "ANALİZ BEKLİYOR",
    className: "bg-slate-100 text-slate-500 border-slate-200",
  };
}

function getEmergencyTag(patient: Patient) {
  const analysesCount = Number(patient._count?.analyses || 0);
  if (analysesCount === 0) {
    return {
      label: "DEĞERLENDİRME",
      className: "bg-slate-100 text-slate-600 border-slate-200",
      isEmergency: false,
    };
  }

  const normalized = normalizeRisk(getEffectiveRisk(patient));
  const emergencyLabels = [
    "severe",
    "proliferative_dr",
    "agir_evre",
    "cok_ileri_evre",
    "yuksek_risk",
    "kritik_risk",
  ];

  if (emergencyLabels.includes(normalized)) {
    return {
      label: "ACİL",
      className: "bg-rose-100 text-rose-700 border-rose-200",
      isEmergency: true,
    };
  }

  return {
    label: "RUTİN",
    className: "bg-emerald-100 text-emerald-700 border-emerald-200",
    isEmergency: false,
  };
}

function formatConfidence(confidence?: number | null) {
  if (typeof confidence !== "number" || Number.isNaN(confidence)) return "-";
  return `%${(confidence * 100).toFixed(1)}`;
}

function formatDateCell(dateValue?: string | null) {
  if (!dateValue) return "-";
  return new Date(dateValue).toLocaleDateString("tr-TR");
}

type HastalarClientProps = {
  patients: Patient[];
  totalFiltered: number;
  page: number;
  totalPages: number;
  pageSize: (typeof PAGE_SIZE_OPTIONS)[number];
  initialFilters: {
    search: string;
    riskFilter: RiskFilter;
    analysisFilter: AnalysisFilter;
    dateFrom: string;
    dateTo: string;
    sort: SortKey;
  };
};

export default function HastalarClient({
  patients,
  totalFiltered,
  page,
  totalPages,
  pageSize,
  initialFilters,
}: HastalarClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [search, setSearch] = useState(initialFilters.search);
  const [riskFilter, setRiskFilter] = useState<RiskFilter>(
    initialFilters.riskFilter,
  );
  const [analysisFilter, setAnalysisFilter] = useState<AnalysisFilter>(
    initialFilters.analysisFilter,
  );
  const [dateFrom, setDateFrom] = useState(initialFilters.dateFrom);
  const [dateTo, setDateTo] = useState(initialFilters.dateTo);
  const [sort, setSort] = useState<SortKey>(initialFilters.sort);
  const [searchDebounced, setSearchDebounced] = useState(initialFilters.search);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkRiskValue, setBulkRiskValue] = useState("Moderate");
  const [isBulkBusy, setIsBulkBusy] = useState(false);

  useEffect(() => {
    setSearch(initialFilters.search);
    setSearchDebounced(initialFilters.search);
    setRiskFilter(initialFilters.riskFilter);
    setAnalysisFilter(initialFilters.analysisFilter);
    setDateFrom(initialFilters.dateFrom);
    setDateTo(initialFilters.dateTo);
    setSort(initialFilters.sort);
    setSelectedIds([]);
  }, [initialFilters]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchDebounced(search.trim());
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  const updateQuery = (
    patch: Partial<{
      search: string;
      risk: RiskFilter;
      analysis: AnalysisFilter;
      dateFrom: string;
      dateTo: string;
      sort: SortKey;
      page: number;
      pageSize: (typeof PAGE_SIZE_OPTIONS)[number];
    }>,
  ) => {
    const params = new URLSearchParams(searchParams.toString());

    const setOrDelete = (key: string, value: string | number | undefined) => {
      if (value === undefined || String(value).trim() === "") {
        params.delete(key);
      } else {
        params.set(key, String(value));
      }
    };

    if (patch.search !== undefined) setOrDelete("search", patch.search);
    if (patch.risk !== undefined)
      setOrDelete("risk", patch.risk === "all" ? "" : patch.risk);
    if (patch.analysis !== undefined)
      setOrDelete("analysis", patch.analysis === "all" ? "" : patch.analysis);
    if (patch.dateFrom !== undefined) setOrDelete("dateFrom", patch.dateFrom);
    if (patch.dateTo !== undefined) setOrDelete("dateTo", patch.dateTo);
    if (patch.sort !== undefined)
      setOrDelete("sort", patch.sort === "createdAt_desc" ? "" : patch.sort);
    if (patch.page !== undefined)
      setOrDelete("page", patch.page <= 1 ? "" : patch.page);
    if (patch.pageSize !== undefined)
      setOrDelete("pageSize", patch.pageSize === 10 ? "" : patch.pageSize);

    router.replace(`?${params.toString()}`);
  };

  useEffect(() => {
    updateQuery({ search: searchDebounced, page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDebounced]);

  const hasActiveFilters =
    searchDebounced.length > 0 ||
    riskFilter !== "all" ||
    analysisFilter !== "all" ||
    dateFrom.length > 0 ||
    dateTo.length > 0 ||
    sort !== "createdAt_desc";

  const resetFilters = () => {
    setSearch(DEFAULT_FILTERS.search);
    setSearchDebounced(DEFAULT_FILTERS.search);
    setRiskFilter(DEFAULT_FILTERS.riskFilter);
    setAnalysisFilter(DEFAULT_FILTERS.analysisFilter);
    setDateFrom(DEFAULT_FILTERS.dateFrom);
    setDateTo(DEFAULT_FILTERS.dateTo);
    setSort(DEFAULT_FILTERS.sort);

    updateQuery({
      search: DEFAULT_FILTERS.search,
      risk: DEFAULT_FILTERS.riskFilter,
      analysis: DEFAULT_FILTERS.analysisFilter,
      dateFrom: DEFAULT_FILTERS.dateFrom,
      dateTo: DEFAULT_FILTERS.dateTo,
      sort: DEFAULT_FILTERS.sort,
      page: 1,
    });
  };

  const selectedOnPageCount = patients.filter((p) =>
    selectedIds.includes(p.id),
  ).length;
  const isAllPageSelected =
    patients.length > 0 && selectedOnPageCount === patients.length;

  const clearSelection = () => setSelectedIds([]);

  const toggleSelectPage = (checked: boolean) => {
    if (!checked) {
      setSelectedIds((prev) =>
        prev.filter((id) => !patients.some((p) => p.id === id)),
      );
      return;
    }

    setSelectedIds((prev) =>
      Array.from(new Set([...prev, ...patients.map((p) => p.id)])),
    );
  };

  const togglePatient = (patientId: string, checked: boolean) => {
    setSelectedIds((prev) =>
      checked
        ? Array.from(new Set([...prev, patientId]))
        : prev.filter((id) => id !== patientId),
    );
  };

  const runBulkRiskUpdate = async () => {
    if (selectedIds.length === 0) return;
    setIsBulkBusy(true);
    try {
      const res = await bulkUpdatePatientRiskAction(selectedIds, bulkRiskValue);
      if (!res.success) {
        throw new Error(res.error || "Toplu risk guncelleme basarisiz.");
      }

      toast({
        title: "Toplu risk güncellendi",
        description: `${res.updatedCount} hasta kaydı güncellendi.`,
      });
      clearSelection();
      router.refresh();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Hata",
        description:
          error instanceof Error
            ? error.message
            : "Toplu güncelleme başarısız.",
      });
    } finally {
      setIsBulkBusy(false);
    }
  };

  const runBulkDelete = async () => {
    if (selectedIds.length === 0) return;

    const ok = window.confirm(
      `${selectedIds.length} hasta kaydi silinecek. Bu isleme bagli analizler de kalici olarak silinir. Devam edilsin mi?`,
    );

    if (!ok) return;

    setIsBulkBusy(true);
    try {
      const res = await bulkDeletePatientsAction(selectedIds);
      if (!res.success) {
        throw new Error(res.error || "Toplu silme basarisiz.");
      }

      toast({
        title: "Toplu silme tamamlandı",
        description: `${res.deletedCount} hasta kaydı silindi.`,
      });
      clearSelection();
      router.refresh();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Hata",
        description:
          error instanceof Error ? error.message : "Toplu silme başarısız.",
      });
    } finally {
      setIsBulkBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="sr-only" aria-live="polite">
        Toplam {totalFiltered} sonuç. Sayfada {patients.length} kayıt, seçili{" "}
        {selectedIds.length} kayıt.
      </div>

      <section
        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5"
        aria-label="Hasta filtreleme ve toplu işlem alanı"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-1">
            <label
              htmlFor="patients-search"
              className="mb-1 block text-xs font-medium text-slate-600"
            >
              Hasta Arama
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="patients-search"
                placeholder="Ad veya TC ile ara"
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-describedby="patients-filter-summary"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="risk-filter"
              className="mb-1 block text-xs font-medium text-slate-600"
            >
              Risk
            </label>
            <select
              id="risk-filter"
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--retina-primary)]"
              value={riskFilter}
              onChange={(e) => {
                const value = e.target.value as RiskFilter;
                setRiskFilter(value);
                updateQuery({ risk: value, page: 1 });
              }}
              aria-label="Risk filtresi"
            >
              <option value="all">Tüm riskler</option>
              <option value="high">Yüksek risk</option>
              <option value="medium">Orta risk</option>
              <option value="low">Düşük risk</option>
              <option value="none">Analiz bekliyor</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="analysis-filter"
              className="mb-1 block text-xs font-medium text-slate-600"
            >
              Analiz Sayısı
            </label>
            <select
              id="analysis-filter"
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--retina-primary)]"
              value={analysisFilter}
              onChange={(e) => {
                const value = e.target.value as AnalysisFilter;
                setAnalysisFilter(value);
                updateQuery({ analysis: value, page: 1 });
              }}
              aria-label="Analiz sayısı filtresi"
            >
              <option value="all">Tüm analiz sayıları</option>
              <option value="none">Analizsiz</option>
              <option value="1-3">1-3 analiz</option>
              <option value="4+">4+ analiz</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="sort-filter"
              className="mb-1 block text-xs font-medium text-slate-600"
            >
              Sıralama
            </label>
            <select
              id="sort-filter"
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--retina-primary)]"
              value={sort}
              onChange={(e) => {
                const value = e.target.value as SortKey;
                setSort(value);
                updateQuery({ sort: value, page: 1 });
              }}
              aria-label="Sıralama"
            >
              <option value="createdAt_desc">En yeni kayıtlar</option>
              <option value="createdAt_asc">En eski kayıtlar</option>
              <option value="fullName_asc">Ada göre A-Z</option>
              <option value="fullName_desc">Ada göre Z-A</option>
              <option value="analysis_desc">Analiz sayısı fazla olandan</option>
            </select>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <div>
            <label
              htmlFor="date-from-filter"
              className="mb-1 block text-xs font-medium text-slate-600"
            >
              Başlangıç
            </label>
            <Input
              id="date-from-filter"
              type="date"
              className="w-full"
              value={dateFrom}
              onChange={(e) => {
                const value = e.target.value;
                setDateFrom(value);
                updateQuery({ dateFrom: value, page: 1 });
              }}
              aria-label="Başlangıç tarihi"
            />
          </div>

          <div>
            <label
              htmlFor="date-to-filter"
              className="mb-1 block text-xs font-medium text-slate-600"
            >
              Bitiş
            </label>
            <Input
              id="date-to-filter"
              type="date"
              className="w-full"
              value={dateTo}
              onChange={(e) => {
                const value = e.target.value;
                setDateTo(value);
                updateQuery({ dateTo: value, page: 1 });
              }}
              aria-label="Bitiş tarihi"
            />
          </div>

          <Button
            type="button"
            variant="outline"
            className="h-10 border-[var(--retina-secondary)] text-[var(--retina-secondary)] transition-colors hover:bg-[var(--retina-secondary)] hover:text-white lg:justify-self-end"
            onClick={resetFilters}
            disabled={!hasActiveFilters}
            aria-label="Filtreleri sıfırla"
          >
            <RefreshCw className="mr-2 h-4 w-4" /> Filtreleri Sıfırla
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4 text-sm">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={isAllPageSelected}
              onCheckedChange={(value) => toggleSelectPage(Boolean(value))}
              aria-label="Bu sayfadaki tüm kayıtları seç"
            />
            <span>Bu sayfadaki tüm kayıtları seç ({patients.length})</span>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--retina-secondary)]">
            Toplu İşlemler
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="bulk-risk-value" className="sr-only">
              Toplu risk değeri
            </label>
            <select
              id="bulk-risk-value"
              className="h-10 min-w-[170px] rounded-md border border-slate-300 bg-white px-3 text-sm"
              value={bulkRiskValue}
              onChange={(e) => setBulkRiskValue(e.target.value)}
              aria-label="Toplu risk değeri"
            >
              <option value="No_DR">Toplu risk: No_DR</option>
              <option value="Mild">Toplu risk: Mild</option>
              <option value="Moderate">Toplu risk: Moderate</option>
              <option value="Severe">Toplu risk: Severe</option>
              <option value="Proliferative_DR">
                Toplu risk: Proliferative_DR
              </option>
            </select>

            <Button
              variant="outline"
              disabled={selectedIds.length === 0 || isBulkBusy}
              onClick={runBulkRiskUpdate}
              aria-label="Seçili hastaların riskini güncelle"
            >
              <RefreshCw className="mr-2 h-4 w-4" /> Seçilileri Güncelle
            </Button>

            <Button
              variant="destructive"
              disabled={selectedIds.length === 0 || isBulkBusy}
              onClick={runBulkDelete}
              aria-label="Seçili hastaları sil"
            >
              <Trash2 className="mr-2 h-4 w-4" /> Seçilileri Sil
            </Button>

            <span className="ml-auto text-xs font-medium text-[var(--retina-secondary)]">
              Seçili: {selectedIds.length}
            </span>
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_290px]">
        <div className="space-y-4 pb-20 xl:pb-0">
          <div className="rounded-lg border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={isAllPageSelected}
                  onCheckedChange={(v) => toggleSelectPage(Boolean(v))}
                  aria-label="Bu sayfadaki tüm kayıtları seç"
                />
                <span>Tümünü seç ({patients.length})</span>
              </div>
              <span id="patients-filter-summary">
                Toplam sonuç: {totalFiltered}
              </span>
            </div>

            {patients.length > 0 ? (
              <>
                <div className="hidden overflow-x-auto md:block">
                  <table
                    className="w-full text-sm"
                    aria-label="Hasta listesi tablosu"
                  >
                    <caption className="sr-only">
                      Son analiz tarihi, güven skoru ve acil etiketi ile hasta
                      listesi
                    </caption>
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th scope="col" className="w-10 px-3 py-3 text-left" />
                        <th scope="col" className="px-3 py-3 text-left">
                          Hasta
                        </th>
                        <th scope="col" className="px-3 py-3 text-left">
                          Son Analiz Tarihi
                        </th>
                        <th scope="col" className="px-3 py-3 text-left">
                          Son Güven Skoru
                        </th>
                        <th scope="col" className="px-3 py-3 text-left">
                          Acil Etiketi
                        </th>
                        <th scope="col" className="px-3 py-3 text-left">
                          Dr Risk Seviyesi
                        </th>
                        <th scope="col" className="px-3 py-3 text-right">
                          Eylem
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {patients.map((patient) => {
                        const effectiveRisk = getEffectiveRisk(patient);
                        const analysisCount = Number(
                          patient._count?.analyses || 0,
                        );
                        const riskInfo =
                          analysisCount === 0
                            ? getRiskStyle("Analiz Yapılmadı")
                            : getRiskStyle(effectiveRisk);
                        const emergencyTag = getEmergencyTag(patient);
                        const checked = selectedIds.includes(patient.id);

                        return (
                          <tr
                            key={patient.id}
                            className="border-t border-slate-100 hover:bg-slate-50/70"
                          >
                            <td className="px-3 py-3">
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(v) =>
                                  togglePatient(patient.id, Boolean(v))
                                }
                                aria-label={`${patient.fullName} kaydını seç`}
                              />
                            </td>
                            <td className="px-3 py-3">
                              <div className="font-semibold text-slate-800">
                                {patient.fullName}
                              </div>
                              <div className="mt-1 text-xs text-slate-500">
                                TC: {patient.tcNo}
                              </div>
                            </td>
                            <td className="px-3 py-3 text-slate-700">
                              {formatDateCell(patient.latestAnalysisAt)}
                            </td>
                            <td className="px-3 py-3 text-slate-700">
                              {formatConfidence(patient.latestConfidence)}
                            </td>
                            <td className="px-3 py-3">
                              <Badge
                                variant="outline"
                                className={`font-semibold ${emergencyTag.className}`}
                              >
                                {emergencyTag.label}
                              </Badge>
                            </td>
                            <td className="px-3 py-3">
                              <Badge
                                variant="outline"
                                className={`inline-flex min-w-[132px] justify-center font-semibold ${riskInfo.className}`}
                              >
                                {riskInfo.label}
                              </Badge>
                            </td>
                            <td className="px-3 py-3 text-right">
                              <Button
                                asChild
                                size="sm"
                                className="rounded-full border border-[#cfd8d7] bg-[#f7f9f8] text-[#476775] shadow-sm hover:bg-[#e8eff2] hover:text-[#2f4957]"
                              >
                                <Link
                                  href={`/dashboard/hastalar/${patient.id}?tab=report-create`}
                                  className="inline-flex items-center gap-1 px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--retina-primary)]"
                                >
                                  Rapor Oluştur <ChevronRight size={14} />
                                </Link>
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="grid gap-3 p-4 md:hidden">
                  {patients.map((patient) => {
                    const effectiveRisk = getEffectiveRisk(patient);
                    const analysisCount = Number(patient._count?.analyses || 0);
                    const riskInfo =
                      analysisCount === 0
                        ? getRiskStyle("Analiz Yapılmadı")
                        : getRiskStyle(effectiveRisk);
                    const emergencyTag = getEmergencyTag(patient);
                    const checked = selectedIds.includes(patient.id);

                    return (
                      <div
                        key={patient.id}
                        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) =>
                              togglePatient(patient.id, Boolean(v))
                            }
                            aria-label={`${patient.fullName} kaydını seç`}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-base font-semibold text-slate-800">
                              {patient.fullName}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              TC: {patient.tcNo}
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className={emergencyTag.className}
                          >
                            {emergencyTag.label}
                          </Badge>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
                          <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
                            Son analiz:{" "}
                            {formatDateCell(patient.latestAnalysisAt)}
                          </div>
                          <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
                            Güven: {formatConfidence(patient.latestConfidence)}
                          </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <Badge
                            variant="outline"
                            className={`inline-flex min-w-[132px] justify-center ${riskInfo.className}`}
                          >
                            {riskInfo.label}
                          </Badge>
                          <Button
                            asChild
                            size="sm"
                            className="h-10 rounded-xl bg-[var(--retina-primary)] px-4 text-white"
                          >
                            <Link
                              href={`/dashboard/hastalar/${patient.id}?tab=report-create`}
                              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--retina-primary)]"
                            >
                              Rapor Oluştur
                            </Link>
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-[#cfd8d7] bg-white py-20">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
                  <Search className="h-8 w-8 text-slate-400" />
                </div>
                <p className="text-lg font-medium text-slate-600">
                  Sonuç bulunamadı
                </p>
                <p className="text-sm text-slate-400">
                  Filtreleri genişletip tekrar deneyin.
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-slate-600">
              Sayfa {page} / {totalPages}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">Sayfa boyutu</span>
              <select
                className="h-10 rounded-md border border-slate-300 bg-white px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--retina-primary)]"
                value={pageSize}
                onChange={(e) => {
                  updateQuery({
                    pageSize: Number(
                      e.target.value,
                    ) as (typeof PAGE_SIZE_OPTIONS)[number],
                    page: 1,
                  });
                }}
                aria-label="Sayfa boyutu seçimi"
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
                className="h-10"
                disabled={page <= 1}
                onClick={() => updateQuery({ page: Math.max(1, page - 1) })}
              >
                Önceki
              </Button>
              <Button
                variant="outline"
                className="h-10"
                disabled={page >= totalPages}
                onClick={() =>
                  updateQuery({ page: Math.min(totalPages, page + 1) })
                }
              >
                Sonraki
              </Button>
            </div>
          </div>
        </div>

        <aside className="hidden xl:block">
          <div
            className="sticky top-24 space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            aria-label="Hızlı işlemler"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--retina-secondary)]">
              Hızlı İşlemler
            </p>

            <Button
              asChild
              className="h-11 w-full justify-between bg-[var(--retina-primary)] text-white hover:bg-[var(--retina-primary-deep)] hover:text-white"
            >
              <Link href="/dashboard/hastalar/yeni">
                Yeni Hasta Kaydı <Plus className="h-4 w-4" />
              </Link>
            </Button>

            <Button
              asChild
              variant="outline"
              className="h-11 w-full justify-between"
            >
              <Link href="/dashboard/raporlar">
                Rapor Geçmişi <FileText className="h-4 w-4" />
              </Link>
            </Button>

          </div>
        </aside>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 p-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur xl:hidden"
        aria-label="Mobil hızlı işlemler"
      >
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-2">
          <Button
            asChild
            className="h-12 rounded-xl bg-[var(--retina-primary)] text-white"
          >
            <Link href="/dashboard/hastalar/yeni">
              <Plus className="mr-2 h-4 w-4" /> Yeni Hasta
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-12 rounded-xl">
            <Link href="/dashboard/raporlar">
              Raporlar <ArrowUpRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </nav>
    </div>
  );
}
