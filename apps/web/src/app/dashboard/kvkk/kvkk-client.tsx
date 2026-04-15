"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { DoctorRole } from "@/lib/roles";
import { useTranslation } from "@/components/providers/i18n-provider";

type ConsentRow = {
  patient: {
    id: string;
    fullName: string;
    tcNo: string;
  };
  consent: {
    consentGiven: boolean;
    consentVersion: string;
    consentAt: string | null;
    note: string | null;
    updatedAt: string;
  } | null;
};

type LogRow = {
  id: string;
  patientId: string | null;
  action: string;
  detail: string;
  createdAt: string;
};

export default function KvkkClient({ role }: { role: DoctorRole }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [rows, setRows] = useState<ConsentRow[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [query, setQuery] = useState("");
  const [consentVersion, setConsentVersion] = useState("v1");
  const [consentNote, setConsentNote] = useState("");
  const [busyPatientId, setBusyPatientId] = useState<string | null>(null);

  const canManage = role === "DOCTOR" || role === "MANAGER";
  const canRunBackup = role === "MANAGER";

  const loadData = async () => {
    const [consentRes, logsRes] = await Promise.all([
      fetch("/api/doctor/kvkk/consent", { method: "GET", cache: "no-store" }),
      fetch("/api/doctor/kvkk/processing-logs?limit=40", {
        method: "GET",
        cache: "no-store",
      }),
    ]);

    if (consentRes.ok) {
      const consentData = (await consentRes.json()) as { rows: ConsentRow[] };
      setRows(consentData.rows || []);
    }

    if (logsRes.ok) {
      const logData = (await logsRes.json()) as { rows: LogRow[] };
      setLogs(logData.rows || []);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (row) =>
        row.patient.fullName.toLowerCase().includes(q) ||
        row.patient.tcNo.toLowerCase().includes(q),
    );
  }, [rows, query]);

  const updateConsent = async (patientId: string, consentGiven: boolean) => {
    if (!canManage) return;

    setBusyPatientId(patientId);
    try {
      const res = await fetch("/api/doctor/kvkk/consent", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          consentGiven,
          consentVersion,
          note: consentNote,
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error || t("kvkkClient.errConsentUpdate"));
      }

      toast({
        title: t("kvkkClient.toastConsentOkTitle"),
        description: t("kvkkClient.toastConsentOkDesc"),
      });

      await loadData();
    } catch (error) {
      toast({
        variant: "destructive",
        title: t("errorPage.title"),
        description:
          error instanceof Error ? error.message : t("kvkkClient.errConsentUpdate"),
      });
    } finally {
      setBusyPatientId(null);
    }
  };

  const anonymizePatient = async (patientId: string) => {
    if (!canManage) return;

    const ok = window.confirm(
      t("kvkkClient.confirmAnonymize"),
    );
    if (!ok) return;

    setBusyPatientId(patientId);
    try {
      const res = await fetch("/api/doctor/kvkk/anonymize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error || t("kvkkClient.errAnonymize"));
      }

      toast({
        title: t("kvkkClient.toastAnonymizeOkTitle"),
        description: t("kvkkClient.toastAnonymizeOkDesc"),
      });

      await loadData();
    } catch (error) {
      toast({
        variant: "destructive",
        title: t("errorPage.title"),
        description:
          error instanceof Error ? error.message : t("kvkkClient.errAnonymize"),
      });
    } finally {
      setBusyPatientId(null);
    }
  };

  const runStorageBackup = async () => {
    if (!canRunBackup) return;

    try {
      const res = await fetch("/api/storage/backup", {
        method: "POST",
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error || t("kvkkClient.errBackup"));
      }

      const data = (await res.json()) as { backupDir: string };
      toast({
        title: t("kvkkClient.toastBackupOkTitle"),
        description: t("kvkkClient.toastBackupOkDesc", { path: data.backupDir }),
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: t("errorPage.title"),
        description:
          error instanceof Error ? error.message : t("kvkkClient.errBackup"),
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-4">
        <Input
          placeholder={t("kvkkClient.placeholderSearch")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Input
          placeholder={t("kvkkClient.placeholderVersion")}
          value={consentVersion}
          onChange={(e) => setConsentVersion(e.target.value || "v1")}
        />
        <Input
          placeholder={t("kvkkClient.placeholderNote")}
          value={consentNote}
          onChange={(e) => setConsentNote(e.target.value)}
        />
        <div className="text-sm text-slate-600 flex items-center justify-end">
          {t("kvkkClient.totalPatients", { count: filteredRows.length })}
        </div>
      </div>

      {canRunBackup && (
        <div className="flex justify-end">
          <Button variant="outline" onClick={runStorageBackup}>
            {t("kvkkClient.backupButton")}
          </Button>
        </div>
      )}

      <div className="rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="p-3 text-left">{t("kvkkClient.colPatient")}</th>
              <th className="p-3 text-left">{t("kvkkClient.colTc")}</th>
              <th className="p-3 text-left">{t("kvkkClient.colConsent")}</th>
              <th className="p-3 text-left">{t("kvkkClient.colVersion")}</th>
              <th className="p-3 text-left">{t("kvkkClient.colUpdated")}</th>
              <th className="p-3 text-right">{t("kvkkClient.colAction")}</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => {
              const busy = busyPatientId === row.patient.id;

              return (
                <tr key={row.patient.id} className="border-b border-slate-100">
                  <td className="p-3 font-medium text-slate-800">
                    {row.patient.fullName}
                  </td>
                  <td className="p-3 text-slate-600">{row.patient.tcNo}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={Boolean(row.consent?.consentGiven)}
                        disabled
                      />
                      <span>
                        {row.consent?.consentGiven
                          ? t("kvkkClient.consentApproved")
                          : t("kvkkClient.consentNone")}
                      </span>
                    </div>
                  </td>
                  <td className="p-3">{row.consent?.consentVersion || "-"}</td>
                  <td className="p-3 text-slate-500">
                    {row.consent?.updatedAt
                      ? new Date(row.consent.updatedAt).toLocaleString("tr-TR")
                      : "-"}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-2">
                      {canManage && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => updateConsent(row.patient.id, true)}
                          >
                            {t("kvkkClient.approveConsent")}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => updateConsent(row.patient.id, false)}
                          >
                            {t("kvkkClient.revokeConsent")}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={busy}
                            onClick={() => anonymizePatient(row.patient.id)}
                          >
                            {t("kvkkClient.anonymize")}
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-800">
          {t("kvkkClient.logsTitle")}
        </h3>
        <div className="mt-3 space-y-2">
          {logs.length === 0 ? (
            <p className="text-sm text-slate-500">
              {t("kvkkClient.logsEmpty")}
            </p>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
              >
                <div className="font-medium text-slate-800">{log.action}</div>
                <div className="text-slate-600">{log.detail}</div>
                <div className="text-xs text-slate-500 mt-1">
                  {new Date(log.createdAt).toLocaleString("tr-TR")}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
