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

export function UpdatePatientDialog({ open, onOpenChange, patient }: any) {
  const { toast } = useToast();
  const router = useRouter();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        await updatePatientAction(formData);

        toast({
          title: "Başarılı",
          description: "Hasta bilgileri güncellendi",
          duration: 3000,
        });
        onOpenChange(false); // modal kapat
        router.refresh(); // 🔥 SAYFAYI YENİLE (DOĞRU YER)

        onOpenChange(false);
      } catch {
        toast({
          variant: "destructive",
          title: "Hata",
          description: "Güncelleme başarısız",
        });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Hasta Bilgilerini Güncelle</DialogTitle>
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
            <Label>Yaş</Label>
            <Input name="age" defaultValue={patient.age} />
          </div>

          <div>
            <Label>Diyabet Süresi</Label>
            <Input name="diabetesYears" defaultValue={patient.diabetesYears} />
          </div>

          <div>
            <Label>HbA1c</Label>
            <Input name="hba1c" defaultValue={patient.hba1c} />
          </div>

          <Button type="submit" className="w-full">
            Güncelle
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
