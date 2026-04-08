"use client";

import { useEffect, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type SummaryRow = {
  metricKey: string;
  metricLabel: string;
  direction: "LOWER_IS_BETTER" | "HIGHER_IS_BETTER";
  baselineValue: number;
  currentValue: number;
  unit: string;
  sampleSize: number;
  periodStart: string;
  periodEnd: string;
  improvementPercent: number | null;
};

type EventRow = SummaryRow & {
  id: string;
  note: string | null;
  createdAt: string;
};

type SnapshotRow = {
  id: string;
  snapshotMonth: string;
  eventCount: number;
  generatedAt: string;
  summary: SummaryRow[];
};

const METRIC_OPTIONS = [
  {
    key: "TIME_PER_PATIENT_MIN",
    label: "Hasta basina sure",
    unit: "dk",
    direction: "LOWER_IS_BETTER" as const,
  },
  {
    key: "ERROR_RATE_PERCENT",
    label: "Hata orani",
    unit: "%",
    direction: "LOWER_IS_BETTER" as const,
  },
  {
    key: "CLINIC_VISIT_DURATION_MIN",
    label: "Muayene toplam suresi",
    unit: "dk",
    direction: "LOWER_IS_BETTER" as const,
  },
];

function formatImprovement(value: number | null) {
  if (value === null || Number.isNaN(value)) return "-";
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

export default function PilotMetricsClient({
  canWrite,
}: {
  canWrite: boolean;
}) {
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [snapshots, setSnapshots] = useState<SnapshotRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [error, setError] = useState("");

  const [metricKey, setMetricKey] = useState(METRIC_OPTIONS[0].key);
  const [baselineValue, setBaselineValue] = useState("20");
  const [currentValue, setCurrentValue] = useState("15");
  const [sampleSize, setSampleSize] = useState("100");
  const [periodStart, setPeriodStart] = useState(
    new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString().slice(0, 10),
  );
  const [periodEnd, setPeriodEnd] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [note, setNote] = useState("");

  const selectedMetric =
    METRIC_OPTIONS.find((option) => option.key === metricKey) ||
    METRIC_OPTIONS[0];

  const loadData = async () => {
    setError("");
    const res = await fetch("/api/doctor/pilot-metrics?limit=120", {
      method: "GET",
      cache: "no-store",
    });

    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error || "Pilot metrikleri yuklenemedi");
      return;
    }

    const data = (await res.json()) as {
      success: boolean;
      summary: SummaryRow[];
      events: EventRow[];
      snapshots?: SnapshotRow[];
    };

    setSummary(data.summary || []);
    setEvents(data.events || []);
    setSnapshots(data.snapshots || []);
  };

  useEffect(() => {
    void loadData();
  }, []);

  const onSubmit = async () => {
    if (!canWrite) return;

    setBusy(true);
    setError("");

    try {
      const res = await fetch("/api/doctor/pilot-metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metricKey: selectedMetric.key,
          metricLabel: selectedMetric.label,
          direction: selectedMetric.direction,
          baselineValue: Number(baselineValue),
          currentValue: Number(currentValue),
          unit: selectedMetric.unit,
          sampleSize: Number(sampleSize),
          periodStart: `${periodStart}T00:00:00.000Z`,
          periodEnd: `${periodEnd}T23:59:59.000Z`,
          note,
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error || "Kayit basarisiz");
      }

      setNote("");
      await loadData();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Kayit basarisiz",
      );
    } finally {
      setBusy(false);
    }
  };

  const downloadCsv = async () => {
    setActionBusy(true);
    setError("");

    try {
      const res = await fetch(
        "/api/doctor/pilot-metrics?format=csv&limit=500",
        {
          method: "GET",
        },
      );

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "CSV export basarisiz");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      link.href = url;
      link.download = `pilot-metrikleri-${stamp}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "CSV export basarisiz",
      );
    } finally {
      setActionBusy(false);
    }
  };

  const downloadPdf = () => {
    try {
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const nowText = new Date().toLocaleString("tr-TR");

      doc.setFontSize(16);
      doc.text("Prospektif Pilot Metrik Ozeti", 40, 42);
      doc.setFontSize(10);
      doc.text(`Olusturulma: ${nowText}`, 40, 60);

      autoTable(doc, {
        startY: 76,
        head: [["Metrik", "Baslangic", "Guncel", "Iyilesme", "Orneklem"]],
        body: summary.map((row) => [
          row.metricLabel,
          `${row.baselineValue} ${row.unit}`,
          `${row.currentValue} ${row.unit}`,
          formatImprovement(row.improvementPercent),
          String(row.sampleSize),
        ]),
      });

      autoTable(doc, {
        startY: (doc as jsPDF & { lastAutoTable?: { finalY?: number } })
          .lastAutoTable?.finalY
          ? ((doc as jsPDF & { lastAutoTable?: { finalY?: number } })
              .lastAutoTable?.finalY || 120) + 20
          : 220,
        head: [["Tarih", "Metrik", "Degisim", "Not"]],
        body: events
          .slice(0, 20)
          .map((event) => [
            new Date(event.createdAt).toLocaleDateString("tr-TR"),
            event.metricLabel,
            `${event.baselineValue} -> ${event.currentValue} ${event.unit}`,
            event.note || "-",
          ]),
      });

      const fileStamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      doc.save(`pilot-metrikleri-${fileStamp}.pdf`);
    } catch {
      setError("PDF export olusturulamadi");
    }
  };

  const createSnapshot = async () => {
    if (!canWrite) return;

    setActionBusy(true);
    setError("");

    try {
      const res = await fetch("/api/doctor/pilot-metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "CREATE_SNAPSHOT" }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Snapshot olusturulamadi");
      }

      await loadData();
    } catch (snapshotError) {
      setError(
        snapshotError instanceof Error
          ? snapshotError.message
          : "Snapshot olusturulamadi",
      );
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-3">
        <label className="space-y-1 text-sm text-slate-700">
          <span>Metrik</span>
          <select
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3"
            value={metricKey}
            onChange={(e) => setMetricKey(e.target.value)}
            disabled={!canWrite}
          >
            {METRIC_OPTIONS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-sm text-slate-700">
          <span>Baslangic degeri ({selectedMetric.unit})</span>
          <Input
            type="number"
            value={baselineValue}
            onChange={(e) => setBaselineValue(e.target.value)}
            disabled={!canWrite}
          />
        </label>

        <label className="space-y-1 text-sm text-slate-700">
          <span>Guncel deger ({selectedMetric.unit})</span>
          <Input
            type="number"
            value={currentValue}
            onChange={(e) => setCurrentValue(e.target.value)}
            disabled={!canWrite}
          />
        </label>

        <label className="space-y-1 text-sm text-slate-700">
          <span>Orneklem sayisi</span>
          <Input
            type="number"
            value={sampleSize}
            onChange={(e) => setSampleSize(e.target.value)}
            disabled={!canWrite}
          />
        </label>

        <label className="space-y-1 text-sm text-slate-700">
          <span>Periyot baslangici</span>
          <Input
            type="date"
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
            disabled={!canWrite}
          />
        </label>

        <label className="space-y-1 text-sm text-slate-700">
          <span>Periyot bitisi</span>
          <Input
            type="date"
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
            disabled={!canWrite}
          />
        </label>

        <label className="space-y-1 text-sm text-slate-700 md:col-span-3">
          <span>Not</span>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={!canWrite}
          />
        </label>

        <div className="md:col-span-3 flex justify-end">
          <Button onClick={onSubmit} disabled={!canWrite || busy}>
            {busy ? "Kaydediliyor..." : "Pilot Metrigi Kaydet"}
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={downloadCsv} disabled={actionBusy}>
          CSV Indir
        </Button>
        <Button variant="outline" onClick={downloadPdf} disabled={actionBusy}>
          PDF Indir
        </Button>
        <Button onClick={createSnapshot} disabled={!canWrite || actionBusy}>
          Aylik Snapshot Olustur
        </Button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-800">Guncel Ozet</h3>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          {summary.length === 0 ? (
            <p className="text-sm text-slate-500">Henuz ozet metrik yok.</p>
          ) : (
            summary.map((row) => (
              <div
                key={row.metricKey}
                className="rounded-lg border border-slate-200 p-3"
              >
                <p className="text-sm font-medium text-slate-800">
                  {row.metricLabel}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Baslangic: {row.baselineValue} {row.unit} • Guncel:{" "}
                  {row.currentValue} {row.unit}
                </p>
                <div className="mt-2">
                  <Badge variant="outline">
                    Iyilesme: {formatImprovement(row.improvementPercent)}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-800">Kayit Gecmisi</h3>
        <div className="mt-3 space-y-2">
          {events.length === 0 ? (
            <p className="text-sm text-slate-500">Henuz metrik kaydi yok.</p>
          ) : (
            events.map((event) => (
              <div
                key={event.id}
                className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-slate-800">
                    {event.metricLabel}
                  </p>
                  <Badge variant="secondary">
                    {formatImprovement(event.improvementPercent)}
                  </Badge>
                </div>
                <p className="mt-1 text-slate-600">
                  {event.baselineValue}
                  {" -> "}
                  {event.currentValue} {event.unit}
                  {" | n="}
                  {event.sampleSize}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {new Date(event.periodStart).toLocaleDateString("tr-TR")} -{" "}
                  {new Date(event.periodEnd).toLocaleDateString("tr-TR")}
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-800">
          Aylik Snapshot Gecmisi
        </h3>
        <div className="mt-3 space-y-2">
          {snapshots.length === 0 ? (
            <p className="text-sm text-slate-500">
              Henuz snapshot olusturulmadi.
            </p>
          ) : (
            snapshots.map((snapshot) => (
              <div
                key={snapshot.id}
                className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-slate-800">
                    {snapshot.snapshotMonth}
                  </p>
                  <Badge variant="outline">Kayit: {snapshot.eventCount}</Badge>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Uretim zamani:{" "}
                  {new Date(snapshot.generatedAt).toLocaleString("tr-TR")}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {snapshot.summary.map((row) => (
                    <Badge
                      key={`${snapshot.id}-${row.metricKey}`}
                      variant="secondary"
                    >
                      {row.metricLabel}:{" "}
                      {formatImprovement(row.improvementPercent)}
                    </Badge>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
