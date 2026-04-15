"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, UserPlus } from "lucide-react";
import { createPatientAction } from "@/app/actions/create-patient";
import { useTranslation } from "@/components/providers/i18n-provider";

export default function YeniHastaPage() {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [gender, setGender] = useState("");
  const router = useRouter();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);

    const result = await createPatientAction({
      fullName: formData.get("fullName") as string,
      tcNo: formData.get("tcNo") as string,
      age: Number(formData.get("age")),
      gender: gender,
      diabetesYears: formData.get("diabetesYears")
        ? Number(formData.get("diabetesYears"))
        : null,
      hba1c: formData.get("hba1c") ? Number(formData.get("hba1c")) : null,
    });

    if (result.success) {
      toast({
        title: t("newPatientPage.toastSuccessTitle"),
        description: t("newPatientPage.toastSuccessDesc"),
      });
      router.push("/dashboard/hastalar");
    } else {
      toast({
        variant: "destructive",
        title: t("errorPage.title"),
        description: result.error,
      });
    }
    setIsLoading(false);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-8">
      <Button
        variant="ghost"
        onClick={() => router.back()}
        className="gap-2 border border-[var(--retina-border)] bg-white text-[var(--retina-primary)]"
      >
        <ArrowLeft size={16} /> {t("newPatientPage.back")}
      </Button>

      <Card className="border border-[var(--retina-border)] bg-white shadow-sm">
        <CardHeader className="border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-[#edf5ff] p-2 text-[var(--retina-primary)]">
              <UserPlus className="h-4 w-4" />
            </div>
            <CardTitle>{t("newPatientPage.title")}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label>{t("newPatientPage.fields.fullName")}</Label>
              <Input
                name="fullName"
                required
                className="border-[var(--retina-border)] focus-visible:ring-[#edf5ff]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("newPatientPage.fields.tcNo")}</Label>
                <Input
                  name="tcNo"
                  required
                  inputMode="numeric"
                  maxLength={11}
                  pattern="[0-9]{11}"
                  placeholder=""
                  className="border-[var(--retina-border)] focus-visible:ring-[#edf5ff]"
                  onInput={(e) => {
                    const input = e.currentTarget;
                    input.value = input.value.replace(/\D/g, "");
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label>{t("newPatientPage.fields.age")}</Label>
                <Input
                  name="age"
                  type="number"
                  required
                  className="border-[var(--retina-border)] focus-visible:ring-[#edf5ff]"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("newPatientPage.fields.gender")}</Label>
              <Select onValueChange={setGender}>
                <SelectTrigger className="border-[var(--retina-border)] focus:ring-[#edf5ff]">
                  <SelectValue placeholder={t("newPatientPage.fields.genderPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Erkek">{t("newPatientPage.fields.genderMale")}</SelectItem>
                  <SelectItem value="Kadın">{t("newPatientPage.fields.genderFemale")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div className="space-y-2">
                <Label>{t("newPatientPage.fields.diabetesYearsOptional")}</Label>
                <Input
                  name="diabetesYears"
                  type="number"
                  placeholder={t("newPatientPage.fields.diabetesYearsPlaceholder")}
                  className="border-[var(--retina-border)] focus-visible:ring-[#edf5ff]"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("newPatientPage.fields.hba1cOptional")}</Label>
                <Input
                  name="hba1c"
                  type="number"
                  step="0.1"
                  placeholder={t("newPatientPage.fields.hba1cPlaceholder")}
                  className="border-[var(--retina-border)] focus-visible:ring-[#edf5ff]"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-[var(--retina-primary)] text-white hover:bg-[var(--retina-primary-deep)]"
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="animate-spin" /> : t("newPatientPage.save")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
