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

function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
  tone = "emerald",
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  tone?: "emerald" | "amber" | "indigo";
}) {
  const toneClass =
    tone === "amber"
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

  return (
    <div
      className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${toneClass}`}
    >
      <div className="space-y-0.5">
        <div className="flex items-center gap-2">
          <Label>{label}</Label>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
              checked
                ? "bg-emerald-100 text-emerald-700"
                : "bg-slate-200 text-slate-600"
            }`}
          >
            {checked ? "Açık" : "Kapalı"}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="data-[state=checked]:bg-[#2f9e7e] data-[state=unchecked]:bg-[#94a3b8] [&>span]:bg-[#eef2ff] data-[state=checked]:[&>span]:bg-[#d1fae5] data-[state=unchecked]:[&>span]:bg-[#e2e8f0]"
      />
    </div>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<RetinaSettings>(
    getDefaultRetinaSettings(),
  );
  const { toast } = useToast();

  useEffect(() => {
    setSettings(loadRetinaSettingsFromStorage());
  }, []);

  useEffect(() => {
    if (settings.appearance.darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [settings.appearance.darkMode]);

  const handleSaveSettings = () => {
    const validated = normalizeRetinaSettings(settings);
    setSettings(validated);
    saveRetinaSettingsToStorage(validated);

    toast({
      title: "Ayarlar kaydedildi",
      description: "Klinik tercihleri başarıyla uygulandı.",
    });
  };

  const handleResetDefaults = () => {
    const defaults = getDefaultRetinaSettings();
    setSettings(defaults);
    saveRetinaSettingsToStorage(defaults);

    toast({
      title: "Varsayılanlara dönüldü",
      description: "Ayarlar standart değerlere sıfırlandı.",
    });
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

  return (
    <div className="clinic-app-bg mx-auto max-w-4xl space-y-8 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Sistem Ayarları
        </h1>
        <p className="text-sm text-slate-600">
          Uygulamanın raporlama ve görünüm ayarlarını yönetin.
        </p>
      </div>

      <div className="grid gap-6">
        <Card className="border border-[#d8e0df] bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center gap-4">
            <div className="rounded-lg bg-[#edf2e4] p-2 text-[#64895a]">
              <Building2 size={20} />
            </div>
            <div>
              <CardTitle>Klinik Bilgileri</CardTitle>
              <CardDescription>
                Kurum adı, rapor başlığı ve adres gibi temel tanımlar.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Klinik Adı</Label>
                <Input
                  value={settings.clinic.clinicName}
                  onChange={(e) => updateClinic("clinicName", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>PDF Rapor Başlığı</Label>
                <Input
                  value={settings.clinic.reportHeader}
                  onChange={(e) => updateClinic("reportHeader", e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Klinik Adresi</Label>
              <Textarea
                value={settings.clinic.address}
                onChange={(e) => updateClinic("address", e.target.value)}
                placeholder="Adres, il/ilçe"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-[#d8e0df] bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center gap-4">
            <div className="rounded-lg bg-[#dceaf2] p-2 text-[#5f90ad]">
              <FileText size={20} />
            </div>
            <div>
              <CardTitle>Raporlama Tercihleri</CardTitle>
              <CardDescription>
                Oluşturulan PDF raporlarının içeriğini belirleyin.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <ToggleRow
              label="Doktor Notlarını Dahil Et"
              description="Yazdığınız manuel yorumları rapora ekler."
              checked={settings.report.includeDoctorNotes}
              onCheckedChange={(v) => updateReport("includeDoctorNotes", v)}
            />
            <ToggleRow
              label="Isı Haritasını Dahil Et"
              description="Görsel rapor kısmında heatmap paneli ekler."
              checked={settings.report.includeHeatmap}
              onCheckedChange={(v) => updateReport("includeHeatmap", v)}
            />
            <ToggleRow
              label="İlaç Planını Dahil Et"
              description="Tedavi ve ilaç önerilerini PDF raporda gösterir."
              checked={settings.report.includeMedications}
              onCheckedChange={(v) => updateReport("includeMedications", v)}
            />
            <ToggleRow
              label="Önizlemeyi Otomatik Aç"
              description="PDF oluşturulduğunda önce önizleme sekmesini açar."
              checked={settings.report.autoOpenPreview}
              onCheckedChange={(v) => updateReport("autoOpenPreview", v)}
            />
            <ToggleRow
              label="Kompakt PDF Düzeni"
              description="Yazı boyutunu azaltarak raporu daha az sayfada tutar."
              checked={settings.report.compactPdf}
              onCheckedChange={(v) => updateReport("compactPdf", v)}
            />
          </CardContent>
        </Card>

        <Card className="border border-[#d8e0df] bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center gap-4">
            <div className="rounded-lg bg-[#e9ecf9] p-2 text-[#5d6fa8]">
              <ShieldCheck size={20} />
            </div>
            <div>
              <CardTitle>Triage ve Klinik Eşikler</CardTitle>
              <CardDescription>
                Risk seviyesine göre kontrol süresi ve AI güven eşiği.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Yüksek Risk Kontrol Süresi (gün)</Label>
              <Input
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
              <Label>Orta Risk Kontrol Süresi (gün)</Label>
              <Input
                type="number"
                min={1}
                max={180}
                value={settings.triage.mediumRiskFollowupDays}
                onChange={(e) =>
                  updateTriage("mediumRiskFollowupDays", Number(e.target.value))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Düşük Risk Kontrol Süresi (gün)</Label>
              <Input
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
              <Label>AI Güven Eşiği (0.50 - 0.99)</Label>
              <Input
                type="number"
                min={0.5}
                max={0.99}
                step={0.01}
                value={settings.triage.aiConfidenceThreshold}
                onChange={(e) =>
                  updateTriage("aiConfidenceThreshold", Number(e.target.value))
                }
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-[#d8e0df] bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center gap-4">
            <div className="rounded-lg bg-[#fff3e4] p-2 text-[#b17a3f]">
              <BellRing size={20} />
            </div>
            <div>
              <CardTitle>Bildirim Tercihleri</CardTitle>
              <CardDescription>
                Kritik hasta, günlük özet ve takip hatırlatmalarını yönetin.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <ToggleRow
              tone="amber"
              label="Kritik Vaka Uyarısı"
              description="Yüksek riskli analizlerde anlık uyarı verir."
              checked={settings.notifications.criticalCaseAlert}
              onCheckedChange={(v) =>
                updateNotifications("criticalCaseAlert", v)
              }
            />
            <ToggleRow
              tone="amber"
              label="Günlük Rapor Özeti"
              description="Gün sonunda analiz adet ve risk dağılım özeti gösterir."
              checked={settings.notifications.dailySummary}
              onCheckedChange={(v) => updateNotifications("dailySummary", v)}
            />
            <ToggleRow
              tone="amber"
              label="Kontrol Takip Hatırlatması"
              description="Planlanan takip günü yaklaşan hastaları listeler."
              checked={settings.notifications.followupReminder}
              onCheckedChange={(v) =>
                updateNotifications("followupReminder", v)
              }
            />
          </CardContent>
        </Card>

        <Card className="border border-[#d8e0df] bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center gap-4">
            <div className="rounded-lg bg-[#efe7da] p-2 text-[#8b6a49]">
              <Moon size={20} />
            </div>
            <div>
              <CardTitle>Görünüm Tercihleri</CardTitle>
              <CardDescription>
                Arayüz temasını kişiselleştirin.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <ToggleRow
              tone="indigo"
              label="Gece Modu"
              description="Sistemi koyu renk şemasına geçirir."
              checked={settings.appearance.darkMode}
              onCheckedChange={(v) => updateAppearance("darkMode", v)}
            />
            <ToggleRow
              tone="indigo"
              label="Yoğun Tablo Modu"
              description="Hasta ve rapor tablolarında daha fazla satır görünür."
              checked={settings.appearance.denseTable}
              onCheckedChange={(v) => updateAppearance("denseTable", v)}
            />
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap justify-end gap-3 pt-4">
        <Button
          variant="outline"
          className="gap-2 border-[#d8e0df]"
          onClick={handleResetDefaults}
        >
          <RotateCcw size={16} /> Varsayılana Dön
        </Button>
        <Button
          className="gap-2 bg-[#659f92] px-8 text-white hover:bg-[#84b9ad]"
          onClick={handleSaveSettings}
        >
          <Save size={18} /> Ayarları Kaydet
        </Button>
      </div>
    </div>
  );
}
