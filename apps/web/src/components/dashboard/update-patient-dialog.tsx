"use client";
import { useRouter } from "next/navigation";

import { startTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { updatePatientAction } from "@/app/actions/update-patient";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/components/providers/i18n-provider";

export function UpdatePatientDialog({ open, onOpenChange, patient }: any) {
  const { toast } = useToast();
  const router = useRouter();
  const { t } = useTranslation();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        await updatePatientAction(formData);

        toast({
          title: t("modal.updatePatient.toast.successTitle"),
          description: t("modal.updatePatient.toast.successDescription"),
          duration: 3000,
        });
        onOpenChange(false); // modal kapat
        router.refresh(); // 🔥 SAYFAYI YENİLE (DOĞRU YER)

        onOpenChange(false);
      } catch {
        toast({
          variant: "destructive",
          title: t("modal.updatePatient.toast.errorTitle"),
          description: t("modal.updatePatient.toast.errorDescription"),
        });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("modal.updatePatient.title")}</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit(new FormData(e.currentTarget));
          }}
          className="space-y-4"
        >
          <input type="hidden" name="id" value={patient.id} />

          <div>
            <Label>{t("modal.updatePatient.fields.age")}</Label>
            <Input name="age" defaultValue={patient.age} />
          </div>

          <div>
            <Label>{t("modal.updatePatient.fields.diabetesYears")}</Label>
            <Input name="diabetesYears" defaultValue={patient.diabetesYears} />
          </div>

          <div>
            <Label>{t("modal.updatePatient.fields.hba1c")}</Label>
            <Input name="hba1c" defaultValue={patient.hba1c} />
          </div>

          <Button type="submit" className="w-full">
            {t("modal.updatePatient.submit")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
