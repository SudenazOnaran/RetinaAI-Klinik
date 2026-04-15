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
import { useTranslation } from "@/components/providers/i18n-provider";

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
  const { t, locale } = useTranslation();
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
        setMessage(data.error || t("integrationsClient.logsLoadFail"));
        return;
      }

      setEvents(data.events || []);
    } catch {
      setMessage(t("integrationsClient.logsUnexpected"));
    } finally {
      setLoadingEvents(false);
    }
  };

  useEffect(() => {
    void refreshEvents();
  }, []);

  const handleExport = async () => {
    if (!selectedPatientId) {
      setMessage(t("integrationsClient.selectPatientError"));
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
        setMessage(data.error || data.message || t("integrationsClient.exportFail"));
      } else {
        setMessage(data.message || t("integrationsClient.exportOk"));
      }

      await refreshEvents();
    } catch {
      setMessage(t("integrationsClient.exportUnexpected"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-4">
        <label className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            {t("integrationsClient.patient")}
          </span>
          <select
            className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
            value={selectedPatientId}
            onChange={(e) => setSelectedPatientId(e.target.value)}
            disabled={patients.length === 0}
          >
            {patients.length === 0 ? (
              <option value="">{t("integrationsClient.noPatient")}</option>
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
            {t("integrationsClient.targetSystem")}
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
            {t("integrationsClient.result")}
          </span>
          <div className="flex h-10 items-center rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700">
            {selectedPatient
              ? t("integrationsClient.analysisCount", { count: selectedPatient.analysisCount })
              : "-"}
          </div>
        </div>

        <div className="flex items-end gap-2">
          <Button
            className="w-full"
            onClick={handleExport}
            disabled={submitting || !selectedPatientId}
          >
            {submitting ? t("integrationsClient.sending") : t("integrationsClient.startExport")}
          </Button>
          <Button
            variant="outline"
            onClick={refreshEvents}
            disabled={loadingEvents}
          >
            {loadingEvents ? t("integrationsClient.loading") : t("integrationsClient.refreshLogs")}
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
              <TableHead>{t("integrationsClient.colDate")}</TableHead>
              <TableHead>{t("integrationsClient.colPatient")}</TableHead>
              <TableHead>{t("integrationsClient.colTarget")}</TableHead>
              <TableHead>{t("integrationsClient.colStatus")}</TableHead>
              <TableHead>HTTP</TableHead>
              <TableHead>{t("integrationsClient.colError")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-slate-500">
                  {t("integrationsClient.emptyLogs")}
                </TableCell>
              </TableRow>
            ) : (
              events.map((event) => (
                <TableRow key={event.id}>
                  <TableCell>
                    {new Date(event.createdAt).toLocaleString(locale === "en" ? "en-US" : "tr-TR")}
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
                      {event.status === "SUCCESS" ? t("integrationsClient.success") : t("integrationsClient.error")}
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
        {t("integrationsClient.envNote")}
      </div>
    </div>
  );
}
