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
} from "@/lib/retina-settings";
import { UserRound, ShieldCheck } from "lucide-react";

type DoctorProfile = RetinaSettings["doctor"];

export default function DoctorProfilePage() {
  const [profile, setProfile] = useState<DoctorProfile>(
    getDefaultRetinaSettings().doctor,
  );
  const [doctorEmail, setDoctorEmail] = useState("");
  const [doctorRole, setDoctorRole] = useState("");
  const [doctorActive, setDoctorActive] = useState<boolean | null>(null);
  const [doctorCreatedAt, setDoctorCreatedAt] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const loadProfile = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/doctor/profile", {
        method: "GET",
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error("Profil verileri alınamadı");
      }

      const data = (await res.json()) as {
        doctor?: {
          name?: string;
          email?: string;
          role?: string;
          isActive?: boolean;
          createdAt?: string;
        };
        profile?: Partial<DoctorProfile>;
      };

      if (data.profile) {
        setProfile((prev) => ({
          ...prev,
          fullName:
            data.profile?.fullName || data.doctor?.name || prev.fullName,
          branch: data.profile?.branch || prev.branch,
          licenseNo: data.profile?.licenseNo || prev.licenseNo,
          contactPhone: data.profile?.contactPhone || prev.contactPhone,
          signatureName:
            data.profile?.signatureName ||
            data.doctor?.name ||
            prev.signatureName,
        }));
      }

      if (data.doctor?.email) {
        setDoctorEmail(data.doctor.email);
      }
      setDoctorRole(data.doctor?.role || "-");
      setDoctorActive(
        typeof data.doctor?.isActive === "boolean"
          ? data.doctor.isActive
          : null,
      );
      setDoctorCreatedAt(data.doctor?.createdAt || "");
    } catch {
      toast({
        variant: "destructive",
        title: "Hata",
        description: "Profil verileri yüklenemedi.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const hydrate = async () => {
      const settings = loadRetinaSettingsFromStorage();
      setProfile(settings.doctor);

      await loadProfile();
    };

    void hydrate();
  }, []);

  const previewName = useMemo(
    () =>
      profile.signatureName || profile.fullName || "Doktor Adı Belirtilmedi",
    [profile.signatureName, profile.fullName],
  );

  return (
    <div className="clinic-app-bg min-h-screen p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="rounded-2xl border border-[#d8e0df] bg-white px-6 py-5 shadow-sm">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Profil Bilgileri
          </h1>
          <p className="mt-2 text-sm text-slate-600">
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
              <Label>Hesap E-postası</Label>
              <Input
                value={doctorEmail}
                disabled
                placeholder="ornek@clinic.com (zorunlu)"
              />
            </div>

            <div className="space-y-2">
              <Label>Rol</Label>
              <Input value={doctorRole || "-"} disabled />
            </div>

            <div className="space-y-2">
              <Label>Hesap Durumu</Label>
              <Input
                value={
                  doctorActive === null ? "-" : doctorActive ? "Aktif" : "Pasif"
                }
                disabled
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Kayıt Tarihi</Label>
              <Input
                value={
                  doctorCreatedAt
                    ? new Date(doctorCreatedAt).toLocaleString("tr-TR")
                    : "-"
                }
                disabled
              />
            </div>

            <div className="space-y-2">
              <Label>Doktor Adı Soyadı</Label>
              <Input
                value={profile.fullName}
                disabled
                placeholder="Dr. Ad Soyad"
              />
            </div>

            <div className="space-y-2">
              <Label>Uzmanlık</Label>
              <Input
                value={profile.branch}
                disabled
                placeholder="Göz Hastalıkları"
              />
            </div>

            <div className="space-y-2">
              <Label>Diploma / Sicil No</Label>
              <Input
                value={profile.licenseNo}
                disabled
                placeholder="TR-123456"
              />
            </div>

            <div className="space-y-2">
              <Label>İletişim Telefonu</Label>
              <Input
                value={profile.contactPhone}
                disabled
                placeholder="0 (5__) ___ __ __ (zorunlu)"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>İmzada Görünecek Ad</Label>
              <Input
                value={profile.signatureName}
                disabled
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
            <p>Profil alanları bu ekranda yalnızca görüntülenebilir.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
