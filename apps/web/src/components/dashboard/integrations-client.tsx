"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type IntegrationPatient = {
  id: string;
  fullName: string;
  tcNo: string;
  risk: string;
  createdAt: string;
  analysisCount: number;
};

type IntegrationEvent = {
  id: string;
  patientId: string;
  patientFullName: string;
  target: "FHIR" | "HBYS";
  status: "SUCCESS" | "FAILED";
  httpStatus: number | null;
  errorMessage: string | null;
  createdAt: string;
};

export default function IntegrationsClient({
  patients,
}: {
  patients: IntegrationPatient[];
}) {
  const [target, setTarget] = useState<"FHIR" | "HBYS">("FHIR");
  const [selectedPatientId, setSelectedPatientId] = useState<string>(
    patients[0]?.id ?? "",
  );
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [events, setEvents] = useState<IntegrationEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  const selectedPatient = useMemo(
    () => patients.find((item) => item.id === selectedPatientId) ?? null,
    [patients, selectedPatientId],
  );

  const refreshEvents = async () => {
    setLoadingEvents(true);
    setMessage("");

    try {
      const res = await fetch("/api/doctor/integrations/events?limit=30", {
        method: "GET",
        cache: "no-store",
      });

      const data = (await res.json()) as {
        success?: boolean;
        events?: IntegrationEvent[];
        error?: string;
      };

      if (!res.ok || !data.success) {
        setMessage(data.error || "Loglar yuklenemedi");
        return;
      }

      setEvents(data.events || []);
    } catch {
      setMessage("Loglar yuklenirken beklenmeyen bir hata olustu");
    } finally {
      setLoadingEvents(false);
    }
  };

  useEffect(() => {
    void refreshEvents();
  }, []);

  const handleExport = async () => {
    if (!selectedPatientId) {
      setMessage("Lutfen bir hasta secin");
      return;
    }

    setSubmitting(true);
    setMessage("");

    try {
      const res = await fetch("/api/doctor/integrations/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          patientId: selectedPatientId,
          target,
        }),
      });

      const data = (await res.json()) as {
        success?: boolean;
        message?: string;
        error?: string;
      };

      if (!res.ok || !data.success) {
        setMessage(data.error || data.message || "Aktarim basarisiz");
      } else {
        setMessage(data.message || "Aktarim basarili");
      }

      await refreshEvents();
    } catch {
      setMessage("Aktarim sirasinda beklenmeyen bir hata olustu");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-4">
        <label className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Hasta
          </span>
          <select
            className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
            value={selectedPatientId}
            onChange={(e) => setSelectedPatientId(e.target.value)}
            disabled={patients.length === 0}
          >
            {patients.length === 0 ? (
              <option value="">Hasta bulunamadi</option>
            ) : (
              patients.map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patient.fullName} ({patient.tcNo})
                </option>
              ))
            )}
          </select>
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Hedef Sistem
          </span>
          <select
            className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
            value={target}
            onChange={(e) =>
              setTarget(e.target.value === "HBYS" ? "HBYS" : "FHIR")
            }
          >
            <option value="FHIR">HL7 FHIR</option>
            <option value="HBYS">HBYS API</option>
          </select>
        </label>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Sonuc
          </span>
          <div className="flex h-10 items-center rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700">
            {selectedPatient ? `${selectedPatient.analysisCount} analiz` : "-"}
          </div>
        </div>

        <div className="flex items-end gap-2">
          <Button
            className="w-full"
            onClick={handleExport}
            disabled={submitting || !selectedPatientId}
          >
            {submitting ? "Gonderiliyor..." : "Aktarimi Baslat"}
          </Button>
          <Button
            variant="outline"
            onClick={refreshEvents}
            disabled={loadingEvents}
          >
            {loadingEvents ? "Yukleniyor..." : "Loglari Yenile"}
          </Button>
        </div>
      </div>

      {message ? (
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
          {message}
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tarih</TableHead>
              <TableHead>Hasta</TableHead>
              <TableHead>Hedef</TableHead>
              <TableHead>Durum</TableHead>
              <TableHead>HTTP</TableHead>
              <TableHead>Hata</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-slate-500">
                  Henuz entegrasyon logu yok.
                </TableCell>
              </TableRow>
            ) : (
              events.map((event) => (
                <TableRow key={event.id}>
                  <TableCell>
                    {new Date(event.createdAt).toLocaleString("tr-TR")}
                  </TableCell>
                  <TableCell>
                    {event.patientFullName || event.patientId}
                  </TableCell>
                  <TableCell>{event.target}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        event.status === "SUCCESS" ? "default" : "destructive"
                      }
                    >
                      {event.status === "SUCCESS" ? "Basarili" : "Hata"}
                    </Badge>
                  </TableCell>
                  <TableCell>{event.httpStatus ?? "-"}</TableCell>
                  <TableCell className="max-w-[280px] truncate">
                    {event.errorMessage || "-"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="rounded-xl border border-[#dae7f8] bg-[#f7fbff] px-4 py-3 text-xs text-slate-600">
        Not: Endpoint tanimlari ortam degiskenlerinden okunur. FHIR icin
        FHIR_EXPORT_URL/FHIR_BASE_URL, HBYS icin HBYS_EXPORT_URL/HBYS_BASE_URL
        ayarlayin. Kimlik dogrulama icin FHIR_AUTH_TOKEN ve HBYS_API_KEY
        kullanilabilir.
      </div>
    </div>
  );
}
