"use client";
import { useRouter } from "next/navigation";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createPatientAction } from "@/app/actions/create-patient";
import { useTranslation } from "@/components/providers/i18n-provider";

interface AddPatientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddPatientDialog({
  open,
  onOpenChange,
}: AddPatientDialogProps) {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t("modal.addPatient.title")}</DialogTitle>
          <DialogDescription>
            {t("modal.addPatient.description")}
          </DialogDescription>
        </DialogHeader>

        <form
          action={async (formData) => {
            await createPatientAction({
              fullName: String(formData.get("fullName") || ""),
              tcNo: String(formData.get("tcNo") || ""),
              age: Number(formData.get("age") || 0),
              gender: "Belirtilmedi",
            });
            onOpenChange(false);
            router.refresh();
          }}
        >
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="fullName" className="text-right">
                {t("modal.addPatient.fields.fullName")}
              </Label>
              <Input
                id="fullName"
                name="fullName"
                className="col-span-3"
                required
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="tcNo" className="text-right">
                {t("modal.addPatient.fields.tcNo")}
              </Label>
              <Input id="tcNo" name="tcNo" className="col-span-3" required />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="age" className="text-right">
                {t("modal.addPatient.fields.age")}
              </Label>
              <Input
                id="age"
                name="age"
                type="number"
                className="col-span-3"
                required
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit">{t("modal.addPatient.save")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
