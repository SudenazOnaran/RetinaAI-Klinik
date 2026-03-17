"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  RetinaSettings,
  getDefaultRetinaSettings,
  loadRetinaSettingsFromStorage,
  saveRetinaSettingsToStorage,
} from "@/lib/retina-settings";
import { UserRound, Save, RotateCcw, ShieldCheck } from "lucide-react";

type DoctorProfile = RetinaSettings["doctor"];

export default function DoctorProfilePage() {
  const [profile, setProfile] = useState<DoctorProfile>(
    getDefaultRetinaSettings().doctor,
  );
  const [doctorEmail, setDoctorEmail] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    const hydrate = async () => {
      const settings = loadRetinaSettingsFromStorage();
      setProfile(settings.doctor);

      try {
        const res = await fetch("/api/doctor/profile", { method: "GET" });
        if (!res.ok) return;
        const data = (await res.json()) as {
          doctor?: { name?: string; email?: string };
        };

        if (data.doctor?.name) {
          setProfile((prev) => ({
            ...prev,
            fullName: data.doctor?.name || prev.fullName,
            signatureName: prev.signatureName || data.doctor?.name || "",
          }));
        }
        if (data.doctor?.email) {
          setDoctorEmail(data.doctor.email);
        }
      } catch {
        // Profil yerel ayarlarla çalışmaya devam eder.
      }
    };

    void hydrate();
  }, []);

  const previewName = useMemo(
    () =>
      profile.signatureName || profile.fullName || "Doktor Adı Belirtilmedi",
    [profile.signatureName, profile.fullName],
  );

  const updateField = (field: keyof DoctorProfile, value: string) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    const settings = loadRetinaSettingsFromStorage();
    let syncedName = profile.fullName;

    try {
      const res = await fetch("/api/doctor/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: profile.fullName }),
      });

      if (res.ok) {
        const data = (await res.json()) as {
          doctor?: { name?: string; email?: string };
        };
        syncedName = data.doctor?.name || profile.fullName;
        if (data.doctor?.email) {
          setDoctorEmail(data.doctor.email);
        }
      }
    } catch {
      toast({
        variant: "destructive",
        title: "Uyarı",
        description:
          "Profil adı veritabanına kaydedilemedi, yerel ayarlara kaydedildi.",
      });
    }

    const next: RetinaSettings = {
      ...settings,
      doctor: {
        ...profile,
        fullName: syncedName,
      },
    };

    saveRetinaSettingsToStorage(next);

    toast({
      title: "Profil bilgileri kaydedildi",
      description: "Doktor profil ayarları başarıyla güncellendi.",
    });
  };

  const handleReset = () => {
    const defaults = getDefaultRetinaSettings();
    setProfile(defaults.doctor);

    const settings = loadRetinaSettingsFromStorage();
    const next: RetinaSettings = {
      ...settings,
      doctor: defaults.doctor,
    };

    saveRetinaSettingsToStorage(next);

    toast({
      title: "Profil sıfırlandı",
      description: "Doktor profili varsayılan değerlere döndü.",
    });
  };

  return (
    <div className="clinic-app-bg mx-auto max-w-4xl space-y-8 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Profil Bilgileri
        </h1>
        <p className="text-sm text-slate-600">
          Doktor kimlik, uzmanlık ve imza bilgilerini yönetin.
        </p>
      </div>

      <Card className="border border-[#d8e0df] bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center gap-4">
          <div className="rounded-lg bg-[#e2edf8] p-2 text-[#4c7da5]">
            <UserRound size={20} />
          </div>
          <div>
            <CardTitle>Doktor Profili</CardTitle>
            <CardDescription>
              Bu bilgiler rapor imzası ve klinik profilinde kullanılır.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label>Hesap E-postası (Veritabanı)</Label>
            <Input
              value={doctorEmail}
              disabled
              placeholder="ornek@clinic.com"
            />
          </div>

          <div className="space-y-2">
            <Label>Doktor Adı Soyadı</Label>
            <Input
              value={profile.fullName}
              onChange={(e) => updateField("fullName", e.target.value)}
              placeholder="Dr. Ad Soyad"
            />
          </div>

          <div className="space-y-2">
            <Label>Uzmanlık</Label>
            <Input
              value={profile.branch}
              onChange={(e) => updateField("branch", e.target.value)}
              placeholder="Göz Hastalıkları"
            />
          </div>

          <div className="space-y-2">
            <Label>Diploma / Sicil No</Label>
            <Input
              value={profile.licenseNo}
              onChange={(e) => updateField("licenseNo", e.target.value)}
              placeholder="TR-123456"
            />
          </div>

          <div className="space-y-2">
            <Label>İletişim Telefonu</Label>
            <Input
              value={profile.contactPhone}
              onChange={(e) => updateField("contactPhone", e.target.value)}
              placeholder="0 (5__) ___ __ __"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>İmzada Görünecek Ad</Label>
            <Input
              value={profile.signatureName}
              onChange={(e) => updateField("signatureName", e.target.value)}
              placeholder="Dr. Ad Soyad"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border border-[#d8e0df] bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">İmza Önizleme</CardTitle>
          <CardDescription>
            PDF raporunun imza alanında görünecek ad aşağıdaki gibidir.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-[#d8e0df] bg-[#f8fbff] px-4 py-3 text-sm text-slate-700">
            {previewName}
          </div>
        </CardContent>
      </Card>

      <Card className="border border-[#d8e0df] bg-white shadow-sm">
        <CardContent className="flex items-start gap-3 p-4 text-sm text-slate-600">
          <ShieldCheck className="mt-0.5 h-5 w-5 text-[#6c93b0]" />
          <p>
            Profil bilgileri yerel olarak saklanır ve rapor üretimi sırasında
            otomatik kullanılır.
          </p>
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-end gap-3 pt-2">
        <Button
          variant="outline"
          className="gap-2 border-[#d8e0df]"
          onClick={handleReset}
        >
          <RotateCcw size={16} /> Varsayılana Dön
        </Button>

        <Button
          className="gap-2 bg-[#659f92] px-8 text-white hover:bg-[#84b9ad]"
          onClick={handleSave}
        >
          <Save size={18} /> Profili Kaydet
        </Button>
      </div>
    </div>
  );
}
