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
import { createPatient } from "@/app/actions/create-patient";

interface AddPatientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddPatientDialog({
  open,
  onOpenChange,
}: AddPatientDialogProps) {
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Yeni Hasta Ekle</DialogTitle>
          <DialogDescription>
            Yeni hasta bilgilerini girerek kaydı tamamlayın.
          </DialogDescription>
        </DialogHeader>

        <form
          action={async (formData) => {
            await createPatient(formData);
            onOpenChange(false);
            router.refresh();
          }}
        >
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="fullName" className="text-right">
                Ad Soyad
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
                TC Kimlik No
              </Label>
              <Input id="tcNo" name="tcNo" className="col-span-3" required />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="age" className="text-right">
                Yaş
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
            <Button type="submit">Kaydet</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
