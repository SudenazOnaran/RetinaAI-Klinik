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
import { useToast } from "@/hooks/use-toast";
import {
  RetinaSettings,
  getDefaultRetinaSettings,
  loadRetinaSettingsFromStorage,
} from "@/lib/retina-settings";
import { UserRound, ShieldCheck } from "lucide-react";
import { useTranslation } from "@/components/providers/i18n-provider";

type DoctorProfile = RetinaSettings["doctor"];

export default function DoctorProfilePage() {
  const { t, locale } = useTranslation();
  const [profile, setProfile] = useState<DoctorProfile>(
    getDefaultRetinaSettings().doctor,
  );
  const [doctorEmail, setDoctorEmail] = useState("");
  const [doctorRole, setDoctorRole] = useState("");
  const [doctorActive, setDoctorActive] = useState<boolean | null>(null);
  const [doctorCreatedAt, setDoctorCreatedAt] = useState("");
  const { toast } = useToast();

  const loadProfile = async () => {
    try {
      const res = await fetch("/api/doctor/profile", {
        method: "GET",
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error("Profile fetch failed");
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
        title: t("errorPage.title"),
        description: t("profilePage.toastLoadFail"),
      });
    } finally {
      // loading state handled by render
    }
  };

  useEffect(() => {
    const hydrate = async () => {
      const settings = loadRetinaSettingsFromStorage();
      setProfile(settings.doctor);

      await loadProfile();
    };

    void hydrate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const previewName = useMemo(
    () =>
      profile.signatureName ||
      profile.fullName ||
      t("profilePage.unknownDoctor"),
    [profile.signatureName, profile.fullName, t],
  );

  return (
    <div className="clinic-app-bg min-h-screen p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="rounded-2xl border border-[#d8e0df] bg-white px-6 py-5 shadow-sm">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {t("profilePage.title")}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {t("profilePage.description")}
          </p>
        </div>

        <Card className="border border-[#d8e0df] bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center gap-4">
            <div className="rounded-lg bg-[#e2edf8] p-2 text-[#4c7da5]">
              <UserRound size={20} />
            </div>
            <div>
              <CardTitle>{t("profilePage.cardTitle")}</CardTitle>
              <CardDescription>
                {t("profilePage.cardDesc")}
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>{t("profilePage.accountEmail")}</Label>
              <Input
                value={doctorEmail}
                disabled
                placeholder={t("profilePage.emailPlaceholder")}
              />
            </div>

            <div className="space-y-2">
              <Label>{t("profilePage.role")}</Label>
              <Input value={doctorRole || "-"} disabled />
            </div>

            <div className="space-y-2">
              <Label>{t("profilePage.accountStatus")}</Label>
              <Input
                value={
                  doctorActive === null ? "-" : doctorActive ? t("profilePage.active") : t("profilePage.passive")
                }
                disabled
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>{t("profilePage.createdAt")}</Label>
              <Input
                value={
                  doctorCreatedAt
                    ? new Date(doctorCreatedAt).toLocaleString(locale === "en" ? "en-US" : "tr-TR")
                    : "-"
                }
                disabled
              />
            </div>

            <div className="space-y-2">
              <Label>{t("profilePage.fullName")}</Label>
              <Input
                value={profile.fullName}
                disabled
                placeholder={t("profilePage.fullNamePlaceholder")}
              />
            </div>

            <div className="space-y-2">
              <Label>{t("profilePage.specialty")}</Label>
              <Input
                value={profile.branch}
                disabled
                placeholder={t("profilePage.specialtyPlaceholder")}
              />
            </div>

            <div className="space-y-2">
              <Label>{t("profilePage.license")}</Label>
              <Input
                value={profile.licenseNo}
                disabled
                placeholder="TR-123456"
              />
            </div>

            <div className="space-y-2">
              <Label>{t("profilePage.phone")}</Label>
              <Input
                value={profile.contactPhone}
                disabled
                placeholder={t("profilePage.phonePlaceholder")}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>{t("profilePage.signatureName")}</Label>
              <Input
                value={profile.signatureName}
                disabled
                placeholder={t("profilePage.fullNamePlaceholder")}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-[#d8e0df] bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">{t("profilePage.signaturePreview")}</CardTitle>
            <CardDescription>
              {t("profilePage.signaturePreviewDesc")}
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
            <p>{t("profilePage.readonlyNote")}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
