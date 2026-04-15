"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarClock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  getDefaultRetinaSettings,
  loadRetinaSettingsFromStorage,
  normalizeRetinaSettings,
  saveRetinaSettingsToStorage,
} from "@/lib/retina-settings";
import {
  computePlannedFollowupDate,
  daysUntil,
  isCriticalAlertCandidate,
} from "@/lib/risk-alerts";
import { useTranslation } from "@/components/providers/i18n-provider";

type AlertPatient = {
  id: string;
  fullName: string;
  risk: string;
  latestAnalysisAt: string | null;
  latestConfidence: number | null;
};

type DashboardAlertCenterProps = {
  patients: AlertPatient[];
};

function formatDate(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = String(date.getUTCFullYear());
  return `${day}.${month}.${year}`;
}

export function DashboardAlertCenter({ patients }: DashboardAlertCenterProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [settings, setSettings] = useState(getDefaultRetinaSettings());

  useEffect(() => {
    const hydrate = async () => {
      setSettings(loadRetinaSettingsFromStorage());

      try {
        const res = await fetch("/api/doctor/settings", {
          method: "GET",
          cache: "no-store",
        });
        if (!res.ok) return;

        const data = (await res.json()) as {
          settings?: typeof settings;
        };

        if (data.settings) {
          const normalized = normalizeRetinaSettings(data.settings);
          setSettings(normalized);
          saveRetinaSettingsToStorage(normalized);
        }
      } catch {
        // Yerel ayarlar ile devam.
      }
    };

    void hydrate();

    const onSettingsUpdated = (event: Event) => {
      const custom = event as CustomEvent<typeof settings>;
      if (custom.detail) {
        setSettings(custom.detail);
      }
    };

    window.addEventListener(
      "retina-settings-updated",
      onSettingsUpdated as EventListener,
    );

    return () => {
      window.removeEventListener(
        "retina-settings-updated",
        onSettingsUpdated as EventListener,
      );
    };
  }, []);

  const plannedFollowups = useMemo(() => {
    return patients
      .map((patient) => {
        const plannedDate = computePlannedFollowupDate(
          patient.latestAnalysisAt,
          patient.risk,
          settings,
        );

        if (!plannedDate) {
          return null;
        }

        const remainingDays = daysUntil(plannedDate);

        return {
          ...patient,
          plannedDate,
          remainingDays,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort((a, b) => a.plannedDate.getTime() - b.plannedDate.getTime());
  }, [patients, settings]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const todayKey = new Date().toISOString().slice(0, 10);

    if (settings.notifications.followupReminder) {
      const dueSoon = plannedFollowups.filter(
        (item) => item.remainingDays <= 2,
      );
      if (dueSoon.length > 0) {
        const reminderKey = `followup-reminder-${todayKey}-${dueSoon
          .map((p) => p.id)
          .join("_")}`;

        if (!sessionStorage.getItem(reminderKey)) {
          const firstThree = dueSoon
            .slice(0, 3)
            .map((p) => p.fullName)
            .join(", ");

          toast({
            title: t("alertCenter.followupSoonTitle"),
            description: t("alertCenter.followupSoonDesc", {
              count: dueSoon.length,
              names: firstThree,
            }) + `${
              dueSoon.length > 3 ? "..." : ""
            }`,
          });

          sessionStorage.setItem(reminderKey, "1");
        }
      }
    }

    if (settings.notifications.criticalCaseAlert) {
      const criticalCases = patients.filter((patient) =>
        isCriticalAlertCandidate(
          patient.risk,
          patient.latestConfidence,
          settings,
        ),
      );

      if (criticalCases.length > 0) {
        const criticalKey = `critical-alert-${todayKey}-${criticalCases
          .map((p) => p.id)
          .join("_")}`;

        if (!sessionStorage.getItem(criticalKey)) {
          const names = criticalCases
            .slice(0, 3)
            .map((p) => p.fullName)
            .join(", ");

          toast({
            variant: "destructive",
            title: t("alertCenter.criticalTitle"),
            description: t("alertCenter.criticalDesc", {
              count: criticalCases.length,
              names,
            }) + `${
              criticalCases.length > 3 ? "..." : ""
            }`,
          });

          sessionStorage.setItem(criticalKey, "1");
        }
      }
    }
  }, [patients, plannedFollowups, settings, toast]);

  return (
    <Card className="border border-slate-200 bg-white shadow-sm">
      <CardHeader className="border-b border-slate-200 pb-4">
        <CardTitle className="flex items-center gap-2 text-slate-900">
          <CalendarClock className="h-5 w-5 text-indigo-600" />
          {t("alertCenter.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-4">
        {plannedFollowups.length === 0 ? (
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
            {t("alertCenter.empty")}
          </p>
        ) : (
          plannedFollowups.slice(0, 8).map((item) => (
            <Link
              key={item.id}
              href={`/dashboard/hastalar/${item.id}?tab=reports`}
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--retina-primary)]"
            >
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {item.fullName}
                </p>
                <p className="text-xs text-slate-600">
                  {t("alertCenter.followupPrefix")} {formatDate(item.plannedDate)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {item.remainingDays <= 2 && (
                  <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                    <AlertTriangle className="mr-1 h-3 w-3" /> {t("alertCenter.near")}
                  </Badge>
                )}
                <Badge variant="secondary" className="text-xs">
                  {item.remainingDays < 0
                    ? t("alertCenter.daysLate", { count: Math.abs(item.remainingDays) })
                    : t("alertCenter.daysLeft", { count: item.remainingDays })}
                </Badge>
              </div>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}
