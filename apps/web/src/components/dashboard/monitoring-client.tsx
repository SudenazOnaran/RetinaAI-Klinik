"use client";

import { useEffect, useState } from "react";
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

type HealthResponse = {
  ok: boolean;
  db: "up" | "down";
  timestamp: string;
  dbNow?: string | null;
  error?: string;
};

type AlertRow = {
  id: string;
  source: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  title: string;
  detail: string;
  createdAt: string;
};

type DeploymentProfileResponse = {
  success: boolean;
  deployment: {
    profile: "ON_PREM" | "VPC" | "CLOUD";
    profileLabel: string;
    networkIsolation: string;
    notes: string;
    sla: {
      uptimeTargetPercent: number;
      p1ResponseMinutes: number;
      p1ResolutionHours: number;
      p2ResponseHours: number;
      backupFrequencyHours: number;
      rpoHours: number;
      rtoHours: number;
    };
  };
};

export default function MonitoringClient() {
  const { t } = useTranslation();
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [deployment, setDeployment] = useState<
    DeploymentProfileResponse["deployment"] | null
  >(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const loadAll = async () => {
    setIsLoading(true);
    setError("");

    try {
      const [healthRes, alertsRes, deploymentRes] = await Promise.all([
        fetch("/api/monitoring/health", { method: "GET", cache: "no-store" }),
        fetch("/api/doctor/monitoring/alerts?limit=100", {
          method: "GET",
          cache: "no-store",
        }),
        fetch("/api/doctor/monitoring/deployment-profile", {
          method: "GET",
          cache: "no-store",
        }),
      ]);

      const healthData = (await healthRes.json()) as HealthResponse;
      setHealth(healthData);

      if (!alertsRes.ok) {
        const data = (await alertsRes.json()) as { error?: string };
        setError(data.error || t("monitoringClient.errAlerts"));
        return;
      }

      const alertsData = (await alertsRes.json()) as {
        success?: boolean;
        alerts?: AlertRow[];
      };
      setAlerts(alertsData.alerts || []);

      if (deploymentRes.ok) {
        const deploymentData =
          (await deploymentRes.json()) as DeploymentProfileResponse;
        setDeployment(deploymentData.deployment);
      }
    } catch {
      setError(t("monitoringClient.errUnexpected"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="font-semibold text-slate-700">{t("monitoringClient.systemStatus")}</span>
          <Badge variant={health?.ok ? "default" : "destructive"}>
            {health?.ok ? t("monitoringClient.healthy") : t("monitoringClient.unhealthy")}
          </Badge>
          <span className="text-slate-600">{t("monitoringClient.dbLabel")} {health?.db || "-"}</span>
          <span className="text-slate-500">
            {t("monitoringClient.checkLabel")}{" "}
            {health?.timestamp
              ? new Date(health.timestamp).toLocaleString("tr-TR")
              : "-"}
          </span>
        </div>

        <Button variant="outline" onClick={loadAll} disabled={isLoading}>
          {isLoading ? t("monitoringClient.loading") : t("monitoringClient.refresh")}
        </Button>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-800">
            {t("monitoringClient.deploymentTitle")}
          </h3>
          <Badge variant="outline">{deployment?.profileLabel || "-"}</Badge>
        </div>
        <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
          <div>
            <span className="font-medium text-slate-700">{t("monitoringClient.isolation")}</span>{" "}
            {deployment?.networkIsolation || "-"}
          </div>
          <div>
            <span className="font-medium text-slate-700">{t("monitoringClient.uptimeTarget")}</span>{" "}
            {deployment ? `%${deployment.sla.uptimeTargetPercent}` : "-"}
          </div>
          <div>
            <span className="font-medium text-slate-700">{t("monitoringClient.p1Response")}</span>{" "}
            {deployment ? t("monitoringClient.minutes", { n: deployment.sla.p1ResponseMinutes }) : "-"}
          </div>
          <div>
            <span className="font-medium text-slate-700">{t("monitoringClient.p1Resolve")}</span>{" "}
            {deployment ? t("monitoringClient.hours", { n: deployment.sla.p1ResolutionHours }) : "-"}
          </div>
          <div>
            <span className="font-medium text-slate-700">{t("monitoringClient.rpoRto")}</span>{" "}
            {deployment
              ? t("monitoringClient.hoursPair", { rpo: deployment.sla.rpoHours, rto: deployment.sla.rtoHours })
              : "-"}
          </div>
          <div>
            <span className="font-medium text-slate-700">{t("monitoringClient.backupFreq")}</span>{" "}
            {deployment ? t("monitoringClient.hours", { n: deployment.sla.backupFrequencyHours }) : "-"}
          </div>
        </div>
        {deployment?.notes ? (
          <p className="mt-2 text-xs text-slate-500">{deployment.notes}</p>
        ) : null}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("monitoringClient.colDate")}</TableHead>
              <TableHead>{t("monitoringClient.colSource")}</TableHead>
              <TableHead>{t("monitoringClient.colLevel")}</TableHead>
              <TableHead>{t("monitoringClient.colTitle")}</TableHead>
              <TableHead>{t("monitoringClient.colDetail")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {alerts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-slate-500">
                  {t("monitoringClient.emptyAlerts")}
                </TableCell>
              </TableRow>
            ) : (
              alerts.map((alert) => (
                <TableRow key={alert.id}>
                  <TableCell>
                    {new Date(alert.createdAt).toLocaleString("tr-TR")}
                  </TableCell>
                  <TableCell>{alert.source}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        alert.severity === "CRITICAL"
                          ? "destructive"
                          : alert.severity === "WARNING"
                            ? "secondary"
                            : "default"
                      }
                    >
                      {alert.severity}
                    </Badge>
                  </TableCell>
                  <TableCell>{alert.title}</TableCell>
                  <TableCell className="max-w-[420px] truncate">
                    {alert.detail}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
