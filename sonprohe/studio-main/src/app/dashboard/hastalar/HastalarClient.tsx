"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Calendar,
  ChevronRight,
  Trash2,
  RefreshCw,
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

function getRiskBucket(patient: Patient): RiskFilter {
  const analysesCount = Number(patient._count?.analyses || 0);
  if (analysesCount === 0) return "none";

  const normalized = normalizeRisk(getEffectiveRisk(patient));

  if (!normalized || normalized === "yok") return "none";
  if (
    [
      "severe",
      "proliferative_dr",
      "agir_evre",
      "cok_ileri_evre",
      "yuksek_risk",
      "kritik_risk",
    ].includes(normalized)
  )
    return "high";
  if (["moderate", "orta_evre", "orta", "orta_risk"].includes(normalized))
    return "medium";
  if (
    [
      "mild",
      "hafif_evre",
      "healthy",
      "saglikli",
      "no_dr",
      "dusuk_risk",
    ].includes(normalized)
  )
    return "low";
  return "none";
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
      label: "COK YUKSEK RISK",
      className: "bg-amber-100/80 text-amber-700 border-amber-200",
    };
  }

  if (["agir_evre", "severe"].includes(normalized)) {
    return {
      label: "YUKSEK RISK",
      className: "bg-amber-100/80 text-amber-700 border-amber-200",
    };
  }

  if (["kritik_risk"].includes(normalized)) {
    return {
      label: "COK YUKSEK RISK",
      className: "bg-amber-100/80 text-amber-700 border-amber-200",
    };
  }

  if (["yuksek_risk"].includes(normalized)) {
    return {
      label: "YUKSEK RISK",
      className: "bg-amber-100/80 text-amber-700 border-amber-200",
    };
  }

  if (["moderate", "orta_evre", "orta"].includes(normalized)) {
    return {
      label: "ORTA RISK",
      className: "bg-[#efe7da] text-[#8b6a49] border-[#d9cab5]",
    };
  }

  if (["orta_risk"].includes(normalized)) {
    return {
      label: "ORTA RISK",
      className: "bg-[#efe7da] text-[#8b6a49] border-[#d9cab5]",
    };
  }

  if (["mild", "hafif_evre"].includes(normalized)) {
    return {
      label: "DUSUK RISK",
      className: "bg-[#e8f2ef] text-[#5b8d82] border-[#cfe0dc]",
    };
  }

  if (["dusuk_risk"].includes(normalized)) {
    return {
      label: "DUSUK RISK",
      className: "bg-[#e8f2ef] text-[#5b8d82] border-[#cfe0dc]",
    };
  }

  if (["no_dr", "healthy", "saglikli", "yok"].includes(normalized)) {
    return {
      label: "SAGLIKLI",
      className: "bg-[#dff0ea] text-[#4c8a7d] border-[#c5ddd6]",
    };
  }

  return {
    label: "ANALIZ BEKLIYOR",
    className: "bg-slate-100 text-slate-500 border-slate-200",
  };
}

export default function HastalarClient({ patients }: { patients: Patient[] }) {
  const router = useRouter();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all");
  const [analysisFilter, setAnalysisFilter] = useState<AnalysisFilter>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sort, setSort] = useState<SortKey>("createdAt_desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] =
    useState<(typeof PAGE_SIZE_OPTIONS)[number]>(10);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkRiskValue, setBulkRiskValue] = useState("Moderate");
  const [isBulkBusy, setIsBulkBusy] = useState(false);

  const filteredPatients = useMemo(() => {
    const query = search.trim().toLowerCase();

    const byFilter = patients.filter((patient) => {
      const nameMatch = patient.fullName.toLowerCase().includes(query);
      const tcMatch = patient.tcNo.includes(query);
      const queryOk = query.length === 0 || nameMatch || tcMatch;

      const riskBucket = getRiskBucket(patient);
      const riskOk = riskFilter === "all" || riskBucket === riskFilter;

      const analysesCount = Number(patient._count?.analyses || 0);
      const analysisOk =
        analysisFilter === "all" ||
        (analysisFilter === "none" && analysesCount === 0) ||
        (analysisFilter === "1-3" &&
          analysesCount >= 1 &&
          analysesCount <= 3) ||
        (analysisFilter === "4+" && analysesCount >= 4);

      const createdDate = new Date(patient.createdAt);
      const fromOk =
        !dateFrom || createdDate >= new Date(`${dateFrom}T00:00:00`);
      const toOk = !dateTo || createdDate <= new Date(`${dateTo}T23:59:59`);

      return queryOk && riskOk && analysisOk && fromOk && toOk;
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
      if (sort === "fullName_asc") {
        return a.fullName.localeCompare(b.fullName, "tr");
      }
      if (sort === "fullName_desc") {
        return b.fullName.localeCompare(a.fullName, "tr");
      }
      return Number(b._count?.analyses || 0) - Number(a._count?.analyses || 0);
    });
  }, [patients, search, riskFilter, analysisFilter, dateFrom, dateTo, sort]);

  const totalPages = Math.max(1, Math.ceil(filteredPatients.length / pageSize));
  const safePage = Math.min(page, totalPages);

  const pagedPatients = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredPatients.slice(start, start + pageSize);
  }, [filteredPatients, safePage, pageSize]);

  const selectedOnPageCount = pagedPatients.filter((p) =>
    selectedIds.includes(p.id),
  ).length;
  const isAllPageSelected =
    pagedPatients.length > 0 && selectedOnPageCount === pagedPatients.length;

  const clearSelection = () => setSelectedIds([]);

  const toggleSelectPage = (checked: boolean) => {
    if (!checked) {
      setSelectedIds((prev) =>
        prev.filter((id) => !pagedPatients.some((p) => p.id === id)),
      );
      return;
    }

    setSelectedIds((prev) =>
      Array.from(new Set([...prev, ...pagedPatients.map((p) => p.id)])),
    );
  };

  const toggleSelectFiltered = (checked: boolean) => {
    if (!checked) {
      clearSelection();
      return;
    }

    setSelectedIds(filteredPatients.map((p) => p.id));
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
        title: "Toplu risk guncellendi",
        description: `${res.updatedCount} hasta kaydi guncellendi.`,
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
            : "Toplu guncelleme basarisiz.",
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
        title: "Toplu silme tamamlandi",
        description: `${res.deletedCount} hasta kaydi silindi.`,
      });
      clearSelection();
      router.refresh();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Hata",
        description:
          error instanceof Error ? error.message : "Toplu silme basarisiz.",
      });
    } finally {
      setIsBulkBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 lg:grid-cols-6">
        <div className="relative lg:col-span-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Ad veya TC ile ara"
            className="pl-9"
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
          <option value="all">Tüm riskler</option>
          <option value="high">Yüksek risk</option>
          <option value="medium">Orta risk</option>
          <option value="low">Düşük risk</option>
          <option value="none">Analiz bekliyor</option>
        </select>

        <select
          className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
          value={analysisFilter}
          onChange={(e) => {
            setAnalysisFilter(e.target.value as AnalysisFilter);
            setPage(1);
          }}
        >
          <option value="all">Tüm analiz sayıları</option>
          <option value="none">Analizsiz</option>
          <option value="1-3">1-3 analiz</option>
          <option value="4+">4+ analiz</option>
        </select>

        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => {
            setDateFrom(e.target.value);
            setPage(1);
          }}
        />

        <Input
          type="date"
          value={dateTo}
          onChange={(e) => {
            setDateTo(e.target.value);
            setPage(1);
          }}
        />

        <div className="lg:col-span-2">
          <select
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
          >
            <option value="createdAt_desc">En yeni kayıtlar</option>
            <option value="createdAt_asc">En eski kayıtlar</option>
            <option value="fullName_asc">Ada göre A-Z</option>
            <option value="fullName_desc">Ada göre Z-A</option>
            <option value="analysis_desc">Analiz sayısı fazla olandan</option>
          </select>
        </div>

        <div className="lg:col-span-2 flex items-center gap-2 text-sm">
          <Checkbox
            checked={
              filteredPatients.length > 0 &&
              selectedIds.length === filteredPatients.length
            }
            onCheckedChange={(value) => toggleSelectFiltered(Boolean(value))}
          />
          <span>Filtredeki tümünü seç ({filteredPatients.length})</span>
        </div>

        <div className="lg:col-span-4 flex flex-wrap items-center gap-2">
          <select
            className="h-10 min-w-[170px] rounded-md border border-slate-300 bg-white px-3 text-sm"
            value={bulkRiskValue}
            onChange={(e) => setBulkRiskValue(e.target.value)}
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
          >
            <RefreshCw className="mr-2 h-4 w-4" /> Seçilileri Güncelle
          </Button>

          <Button
            variant="destructive"
            disabled={selectedIds.length === 0 || isBulkBusy}
            onClick={runBulkDelete}
          >
            <Trash2 className="mr-2 h-4 w-4" /> Seçilileri Sil
          </Button>

          <span className="text-xs text-slate-500">
            Seçili: {selectedIds.length}
          </span>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={isAllPageSelected}
              onCheckedChange={(v) => toggleSelectPage(Boolean(v))}
            />
            <span>Sayfadaki tümünü seç ({pagedPatients.length})</span>
          </div>
          <span>Toplam sonuç: {filteredPatients.length}</span>
        </div>

        <div className="grid gap-4 p-4">
          {pagedPatients.length > 0 ? (
            pagedPatients.map((patient) => {
              const effectiveRisk = getEffectiveRisk(patient);
              const analysisCount = Number(patient._count?.analyses || 0);
              const riskInfo =
                analysisCount === 0
                  ? getRiskStyle("Analiz Yapılmadı")
                  : getRiskStyle(effectiveRisk);
              const checked = selectedIds.includes(patient.id);

              return (
                <div
                  key={patient.id}
                  className="group relative flex flex-col items-center justify-between rounded-2xl border border-[#d8e0df] bg-white p-5 md:flex-row"
                >
                  <div className="flex items-center gap-3 w-full md:w-auto">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) =>
                        togglePatient(patient.id, Boolean(v))
                      }
                    />
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#dceaf2] text-sm font-bold text-[#5f90ad]">
                      {patient.fullName
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .substring(0, 2)
                        .toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-800">
                        {patient.fullName}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1">
                        <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 tracking-wider border border-slate-200">
                          {patient.tcNo}
                        </span>
                        <span className="inline-flex items-center gap-1 text-slate-400">
                          <Calendar size={12} />
                          {new Date(patient.createdAt).toLocaleDateString(
                            "tr-TR",
                          )}
                        </span>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600 border border-slate-200">
                          Analiz: {analysisCount}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 w-full md:w-auto mt-4 md:mt-0 justify-between md:justify-end">
                    <Badge
                      variant="outline"
                      className={`px-3 py-1 text-xs font-bold tracking-wide ${riskInfo.className}`}
                    >
                      {riskInfo.label}
                    </Badge>

                    <Button
                      asChild
                      size="sm"
                      className="rounded-full border border-[#cfd8d7] bg-[#f7f9f8] text-[#476775] hover:bg-[#e8eff2] hover:text-[#2f4957] shadow-sm"
                    >
                      <Link
                        href={`/dashboard/hastalar/${patient.id}?tab=report-create`}
                        className="flex items-center gap-1 px-4"
                      >
                        Rapor Oluştur <ChevronRight size={14} />
                      </Link>
                    </Button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-[#cfd8d7] bg-white py-20">
              <div className="h-16 w-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <Search className="text-slate-400 h-8 w-8" />
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
