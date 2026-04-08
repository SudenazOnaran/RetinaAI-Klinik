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
  
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-4">
      {/* TC ile Arama */}
      <Input
        placeholder="Hasta TC KİMLİK NUMARASI ile ara..."
        className="max-w-sm"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
      />

      {/* Risk Filtresi (şimdilik sadece UI) */}
      <Select value={risk} onValueChange={onRiskChange}>
        <SelectTrigger className="w-44">
          <SelectValue placeholder="Tüm Riskler" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tüm Riskler</SelectItem>
          <SelectItem value="Yüksek">Yüksek</SelectItem>
          <SelectItem value="Orta">Orta</SelectItem>
          <SelectItem value="Düşük">Düşük</SelectItem>
          <SelectItem value="Yok">Analiz Yapılmadı</SelectItem>
        </SelectContent>
      </Select>

      {/* Yeni Hasta */}
      <Button onClick={() => setOpen(true)}>
        Yeni Hasta Ekle
      </Button>

      {/* Modal */}
      <AddPatientDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
