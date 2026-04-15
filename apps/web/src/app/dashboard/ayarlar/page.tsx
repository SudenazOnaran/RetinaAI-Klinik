"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  RetinaSettings,
  getDefaultRetinaSettings,
  loadRetinaSettingsFromStorage,
  normalizeRetinaSettings,
  saveRetinaSettingsToStorage,
} from "@/lib/retina-settings";
import {
  FileText,
  Save,
  Moon,
  Building2,
  BellRing,
  ShieldCheck,
  RotateCcw,
} from "lucide-react";
import { useTranslation } from "@/components/providers/i18n-provider";
import { LanguageSwitcher } from "@/components/layout/language-switcher";

function ToggleRow({
  label,
  description,
  onText,
  offText,
  checked,
  onCheckedChange,
  darkMode,
  tone = "emerald",
}: {
  label: string;
  description: string;
  onText: string;
  offText: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  darkMode: boolean;
  tone?: "emerald" | "amber" | "indigo";
}) {
  const toneClass = darkMode
    ? tone === "amber"
      ? checked
        ? "border-amber-500/40 bg-amber-500/12"
        : "border-slate-700 bg-slate-900/70"
      : tone === "indigo"
        ? checked
          ? "border-indigo-500/40 bg-indigo-500/12"
          : "border-slate-700 bg-slate-900/70"
        : checked
          ? "border-emerald-500/40 bg-emerald-500/12"
          : "border-slate-700 bg-slate-900/70"
    : tone === "amber"
      ? checked
        ? "border-amber-200 bg-amber-50/80"
        : "border-[#d8e0df] bg-[#f6f9f8]"
      : tone === "indigo"
        ? checked
          ? "border-indigo-200 bg-indigo-50/80"
          : "border-[#d8e0df] bg-[#f6f9f8]"
        : checked
          ? "border-emerald-200 bg-emerald-50/80"
          : "border-[#d8e0df] bg-[#f6f9f8]";

  const badgeClass = darkMode
    ? checked
      ? "bg-emerald-900/40 text-emerald-200"
      : "bg-slate-700 text-slate-200"
    : checked
      ? "bg-emerald-100 text-emerald-700"
      : "bg-slate-200 text-slate-600";

  const labelClass = darkMode ? "text-slate-100" : "text-slate-900";
  const descriptionClass = darkMode
    ? "text-slate-400"
    : "text-muted-foreground";
  const switchClass = darkMode
    ? "data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-slate-600 [&>span]:bg-slate-100 data-[state=checked]:[&>span]:bg-emerald-100 data-[state=unchecked]:[&>span]:bg-slate-200"
    : "data-[state=checked]:bg-[#2f9e7e] data-[state=unchecked]:bg-[#94a3b8] [&>span]:bg-[#eef2ff] data-[state=checked]:[&>span]:bg-[#d1fae5] data-[state=unchecked]:[&>span]:bg-[#e2e8f0]";

  return (
    <div
      className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${toneClass}`}
    >
      <div className="space-y-0.5">
        <div className="flex items-center gap-2">
          <Label className={labelClass}>{label}</Label>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${badgeClass}`}
          >
            {checked ? onText : offText}
          </span>
        </div>
        <p className={`text-xs ${descriptionClass}`}>{description}</p>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        className={switchClass}
      />
    </div>
  );
}

export default function SettingsPage() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<RetinaSettings>(
    getDefaultRetinaSettings(),
  );
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const hydrate = async () => {
      const local = loadRetinaSettingsFromStorage();
      setSettings(local);

      try {
        const res = await fetch("/api/doctor/settings", { method: "GET" });
        if (!res.ok) return;

        const data = (await res.json()) as {
          settings?: Partial<RetinaSettings>;
        };

        if (data.settings) {
          const normalized = normalizeRetinaSettings(data.settings);
          setSettings(normalized);
          saveRetinaSettingsToStorage(normalized);
        }
      } catch {
        // Yerel ayarlar ile devam edilir.
      }
    };

    void hydrate();
  }, []);

  useEffect(() => {
    if (settings.appearance.darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [settings.appearance.darkMode]);

  const handleSaveSettings = async () => {
    setIsSaving(true);
    const validated = normalizeRetinaSettings(settings);
    try {
      const res = await fetch("/api/doctor/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: validated }),
      });

      if (!res.ok) {
        throw new Error("Settings could not be saved");
      }

      const data = (await res.json()) as {
        settings?: Partial<RetinaSettings>;
      };

      const next = normalizeRetinaSettings(data.settings ?? validated);
      setSettings(next);
      saveRetinaSettingsToStorage(next);

      toast({
        title: t("settingsPage.toastSavedTitle"),
        description: t("settingsPage.toastSavedDesc"),
      });
    } catch {
      setSettings(validated);
      saveRetinaSettingsToStorage(validated);
      toast({
        variant: "destructive",
        title: t("settingsPage.warnTitle"),
        description: t("settingsPage.toastCentralSaveFail"),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefaults = async () => {
    setIsSaving(true);
    const defaults = getDefaultRetinaSettings();
    try {
      const res = await fetch("/api/doctor/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: defaults }),
      });

      if (!res.ok) {
        throw new Error("Default settings could not be saved");
      }

      setSettings(defaults);
      saveRetinaSettingsToStorage(defaults);

      toast({
        title: t("settingsPage.toastResetTitle"),
        description: t("settingsPage.toastResetDesc"),
      });
    } catch {
      setSettings(defaults);
      saveRetinaSettingsToStorage(defaults);
      toast({
        variant: "destructive",
        title: t("settingsPage.warnTitle"),
        description: t("settingsPage.toastCentralResetFail"),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const updateClinic = (
    field: keyof RetinaSettings["clinic"],
    value: string,
  ) => {
    setSettings((prev) => ({
      ...prev,
      clinic: { ...prev.clinic, [field]: value },
    }));
  };

  const updateReport = (
    field: keyof RetinaSettings["report"],
    value: boolean,
  ) => {
    setSettings((prev) => ({
      ...prev,
      report: { ...prev.report, [field]: value },
    }));
  };

  const updateNotifications = (
    field: keyof RetinaSettings["notifications"],
    value: boolean,
  ) => {
    setSettings((prev) => ({
      ...prev,
      notifications: { ...prev.notifications, [field]: value },
    }));
  };

  const updateAppearance = (
    field: keyof RetinaSettings["appearance"],
    value: boolean,
  ) => {
    setSettings((prev) => ({
      ...prev,
      appearance: { ...prev.appearance, [field]: value },
    }));
  };

  const updateTriage = (
    field: keyof RetinaSettings["triage"],
    value: number,
  ) => {
    setSettings((prev) => ({
      ...prev,
      triage: { ...prev.triage, [field]: value },
    }));
  };

  const isDark = settings.appearance.darkMode;
  const pageContainerClass = "clinic-app-bg min-h-screen p-4 md:p-6";
  const contentContainerClass = isDark
    ? "mx-auto max-w-7xl space-y-8 rounded-2xl border border-slate-700/80 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.14),_transparent_42%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.12),_transparent_36%),linear-gradient(160deg,_#0b1220_0%,_#111827_45%,_#1e293b_100%)] p-4 shadow-2xl shadow-slate-950/40 md:p-6"
    : "mx-auto max-w-7xl space-y-8";
  const cardClass = isDark
    ? "border border-slate-700 bg-slate-900/70 shadow-lg shadow-slate-950/30"
    : "border border-[#d8e0df] bg-white shadow-sm";
  const titleClass = isDark ? "text-slate-100" : "text-slate-900";
  const subtitleClass = isDark ? "text-slate-400" : "text-slate-600";
  const inputClass = isDark
    ? "border-slate-600 bg-slate-900/80 text-slate-100 placeholder:text-slate-500 focus-visible:ring-emerald-500"
    : "border-[#d8e0df] bg-white";
  const labelClass = isDark ? "text-slate-200" : "text-slate-900";
  const cardDescriptionClass = isDark ? "text-slate-400" : "text-slate-600";

  return (
    <div className={pageContainerClass}>
      <div className={contentContainerClass}>
        <div>
          <h1 className={`text-2xl font-bold tracking-tight ${titleClass}`}>
            {t("settingsPage.title")}
          </h1>
          <p className={`text-sm ${subtitleClass}`}>
            {t("settingsPage.description")}
          </p>
        </div>

        <div className="grid gap-6">
          <Card className={cardClass}>
            <CardHeader className="flex flex-row items-center gap-4">
              <div
                className={`rounded-lg p-2 ${
                  isDark
                    ? "bg-cyan-900/40 text-cyan-200"
                    : "bg-cyan-100 text-cyan-700"
                }`}
              >
                <ShieldCheck size={20} />
              </div>
              <div>
                <CardTitle className={titleClass}>
                  {t("settingsPage.languageTitle")}
                </CardTitle>
                <CardDescription className={cardDescriptionClass}>
                  {t("settingsPage.languageDesc")}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <LanguageSwitcher />
            </CardContent>
          </Card>

          <Card className={cardClass}>
            <CardHeader className="flex flex-row items-center gap-4">
              <div
                className={`rounded-lg p-2 ${
                  isDark
                    ? "bg-emerald-900/40 text-emerald-200"
                    : "bg-[#edf2e4] text-[#64895a]"
                }`}
              >
                <Building2 size={20} />
              </div>
              <div>
                <CardTitle className={titleClass}>{t("settingsPage.clinicTitle")}</CardTitle>
                <CardDescription className={cardDescriptionClass}>
                  {t("settingsPage.clinicDesc")}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className={labelClass}>{t("settingsPage.clinicName")}</Label>
                  <Input
                    className={inputClass}
                    value={settings.clinic.clinicName}
                    onChange={(e) => updateClinic("clinicName", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className={labelClass}>{t("settingsPage.reportHeader")}</Label>
                  <Input
                    className={inputClass}
                    value={settings.clinic.reportHeader}
                    onChange={(e) =>
                      updateClinic("reportHeader", e.target.value)
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className={labelClass}>{t("settingsPage.clinicAddress")}</Label>
                <Textarea
                  className={inputClass}
                  value={settings.clinic.address}
                  onChange={(e) => updateClinic("address", e.target.value)}
                  placeholder={t("settingsPage.clinicAddressPlaceholder")}
                />
              </div>
            </CardContent>
          </Card>

          <Card className={cardClass}>
            <CardHeader className="flex flex-row items-center gap-4">
              <div
                className={`rounded-lg p-2 ${
                  isDark
                    ? "bg-sky-900/40 text-sky-200"
                    : "bg-[#dceaf2] text-[#5f90ad]"
                }`}
              >
                <FileText size={20} />
              </div>
              <div>
                <CardTitle className={titleClass}>
                  {t("settingsPage.reportPrefsTitle")}
                </CardTitle>
                <CardDescription className={cardDescriptionClass}>
                  {t("settingsPage.reportPrefsDesc")}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ToggleRow
                label={t("settingsPage.includeDoctorNotes")}
                description={t("settingsPage.includeDoctorNotesDesc")}
                onText={t("settingsPage.on")}
                offText={t("settingsPage.off")}
                checked={settings.report.includeDoctorNotes}
                darkMode={isDark}
                onCheckedChange={(v) => updateReport("includeDoctorNotes", v)}
              />
              <ToggleRow
                label={t("settingsPage.includeHeatmap")}
                description={t("settingsPage.includeHeatmapDesc")}
                onText={t("settingsPage.on")}
                offText={t("settingsPage.off")}
                checked={settings.report.includeHeatmap}
                darkMode={isDark}
                onCheckedChange={(v) => updateReport("includeHeatmap", v)}
              />
              <ToggleRow
                label={t("settingsPage.includeMedications")}
                description={t("settingsPage.includeMedicationsDesc")}
                onText={t("settingsPage.on")}
                offText={t("settingsPage.off")}
                checked={settings.report.includeMedications}
                darkMode={isDark}
                onCheckedChange={(v) => updateReport("includeMedications", v)}
              />
              <ToggleRow
                label={t("settingsPage.autoOpenPreview")}
                description={t("settingsPage.autoOpenPreviewDesc")}
                onText={t("settingsPage.on")}
                offText={t("settingsPage.off")}
                checked={settings.report.autoOpenPreview}
                darkMode={isDark}
                onCheckedChange={(v) => updateReport("autoOpenPreview", v)}
              />
              <ToggleRow
                label={t("settingsPage.compactPdf")}
                description={t("settingsPage.compactPdfDesc")}
                onText={t("settingsPage.on")}
                offText={t("settingsPage.off")}
                checked={settings.report.compactPdf}
                darkMode={isDark}
                onCheckedChange={(v) => updateReport("compactPdf", v)}
              />
            </CardContent>
          </Card>

          <Card className={cardClass}>
            <CardHeader className="flex flex-row items-center gap-4">
              <div
                className={`rounded-lg p-2 ${
                  isDark
                    ? "bg-indigo-900/40 text-indigo-200"
                    : "bg-[#e9ecf9] text-[#5d6fa8]"
                }`}
              >
                <ShieldCheck size={20} />
              </div>
              <div>
                <CardTitle className={titleClass}>
                  {t("settingsPage.triageTitle")}
                </CardTitle>
                <CardDescription className={cardDescriptionClass}>
                  {t("settingsPage.triageDesc")}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className={labelClass}>
                  {t("settingsPage.highRiskDays")}
                </Label>
                <Input
                  className={inputClass}
                  type="number"
                  min={1}
                  max={30}
                  value={settings.triage.highRiskFollowupDays}
                  onChange={(e) =>
                    updateTriage("highRiskFollowupDays", Number(e.target.value))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label className={labelClass}>
                  {t("settingsPage.mediumRiskDays")}
                </Label>
                <Input
                  className={inputClass}
                  type="number"
                  min={1}
                  max={180}
                  value={settings.triage.mediumRiskFollowupDays}
                  onChange={(e) =>
                    updateTriage(
                      "mediumRiskFollowupDays",
                      Number(e.target.value),
                    )
                  }
                />
              </div>
              <div className="space-y-2">
                <Label className={labelClass}>
                  {t("settingsPage.lowRiskDays")}
                </Label>
                <Input
                  className={inputClass}
                  type="number"
                  min={1}
                  max={365}
                  value={settings.triage.lowRiskFollowupDays}
                  onChange={(e) =>
                    updateTriage("lowRiskFollowupDays", Number(e.target.value))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label className={labelClass}>
                  {t("settingsPage.aiThreshold")}
                </Label>
                <Input
                  className={inputClass}
                  type="number"
                  min={0.5}
                  max={0.99}
                  step={0.01}
                  value={settings.triage.aiConfidenceThreshold}
                  onChange={(e) =>
                    updateTriage(
                      "aiConfidenceThreshold",
                      Number(e.target.value),
                    )
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card className={cardClass}>
            <CardHeader className="flex flex-row items-center gap-4">
              <div
                className={`rounded-lg p-2 ${
                  isDark
                    ? "bg-amber-900/40 text-amber-200"
                    : "bg-[#fff3e4] text-[#b17a3f]"
                }`}
              >
                <BellRing size={20} />
              </div>
              <div>
                <CardTitle className={titleClass}>
                  {t("settingsPage.notificationsTitle")}
                </CardTitle>
                <CardDescription className={cardDescriptionClass}>
                  {t("settingsPage.notificationsDesc")}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ToggleRow
                tone="amber"
                label={t("settingsPage.criticalAlert")}
                description={t("settingsPage.criticalAlertDesc")}
                onText={t("settingsPage.on")}
                offText={t("settingsPage.off")}
                checked={settings.notifications.criticalCaseAlert}
                darkMode={isDark}
                onCheckedChange={(v) =>
                  updateNotifications("criticalCaseAlert", v)
                }
              />
              <ToggleRow
                tone="amber"
                label={t("settingsPage.followupReminder")}
                description={t("settingsPage.followupReminderDesc")}
                onText={t("settingsPage.on")}
                offText={t("settingsPage.off")}
                checked={settings.notifications.followupReminder}
                darkMode={isDark}
                onCheckedChange={(v) =>
                  updateNotifications("followupReminder", v)
                }
              />
            </CardContent>
          </Card>

          <Card className={cardClass}>
            <CardHeader className="flex flex-row items-center gap-4">
              <div
                className={`rounded-lg p-2 ${
                  isDark
                    ? "bg-slate-700/70 text-slate-100"
                    : "bg-[#efe7da] text-[#8b6a49]"
                }`}
              >
                <Moon size={20} />
              </div>
              <div>
                <CardTitle className={titleClass}>{t("settingsPage.appearanceTitle")}</CardTitle>
                <CardDescription className={cardDescriptionClass}>
                  {t("settingsPage.appearanceDesc")}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ToggleRow
                tone="indigo"
                label={t("settingsPage.darkMode")}
                description={t("settingsPage.darkModeDesc")}
                onText={t("settingsPage.on")}
                offText={t("settingsPage.off")}
                checked={settings.appearance.darkMode}
                darkMode={isDark}
                onCheckedChange={(v) => updateAppearance("darkMode", v)}
              />
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap justify-end gap-3 pt-4">
          <Button
            variant="outline"
            className={`gap-2 ${
              isDark
                ? "border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700"
                : "border-[#d8e0df]"
            }`}
            onClick={handleResetDefaults}
          >
            <RotateCcw size={16} /> {t("settingsPage.resetDefault")}
          </Button>
          <Button
            className={`gap-2 px-8 text-white ${
              isDark
                ? "bg-emerald-600 hover:bg-emerald-500"
                : "bg-[#659f92] hover:bg-[#84b9ad]"
            }`}
            onClick={handleSaveSettings}
            disabled={isSaving}
          >
            <Save size={18} />{" "}
            {isSaving ? t("settingsPage.saving") : t("settingsPage.save")}
          </Button>
        </div>
      </div>
    </div>
  );
}
