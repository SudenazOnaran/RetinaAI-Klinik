'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AddPatientDialog } from './add-patient-dialog';
import { useTranslation } from '@/components/providers/i18n-provider';

export default function PatientsToolbar({
  search,
  onSearchChange,
  risk,
  onRiskChange,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  risk: 'all' | 'Yüksek' | 'Orta' | 'Yok';
  onRiskChange: (value: 'all' | 'Yüksek' | 'Orta' | 'Yok') => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-4">
      {/* TC ile Arama */}
      <Input
        placeholder={t("patientsToolbar.searchPlaceholder")}
        className="max-w-sm"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
      />

      {/* Risk Filtresi (şimdilik sadece UI) */}
      <Select value={risk} onValueChange={onRiskChange}>
        <SelectTrigger className="w-44">
          <SelectValue placeholder={t("patientsToolbar.riskAll")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("patientsToolbar.riskAll")}</SelectItem>
          <SelectItem value="Yüksek">{t("patientsToolbar.riskHigh")}</SelectItem>
          <SelectItem value="Orta">{t("patientsToolbar.riskMedium")}</SelectItem>
          <SelectItem value="Düşük">{t("patientsToolbar.riskLow")}</SelectItem>
          <SelectItem value="Yok">{t("patientsToolbar.riskNone")}</SelectItem>
        </SelectContent>
      </Select>

      {/* Yeni Hasta */}
      <Button onClick={() => setOpen(true)}>
        {t("patientsToolbar.addPatient")}
      </Button>

      {/* Modal */}
      <AddPatientDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
