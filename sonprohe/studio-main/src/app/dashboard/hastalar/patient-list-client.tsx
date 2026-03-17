"use client";

import { useState } from "react";
import PatientsToolbar from "@/components/dashboard/patients-toolbar";
import PatientTable from "@/components/dashboard/patient-table";

export default function PatientListClient({ patients }: { patients: any[] }) {
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState<
    "all" | "Yüksek" | "Orta" | "Yok"
  >("all");

  const filteredPatients = patients
    .filter((p) => String(p.tcNo).includes(search.trim()))
    .filter((p) => {
      if (riskFilter === "all") return true;

      if (riskFilter === "Yok") {
        return !p.risk || p.risk.trim() === "" || p.risk === "Yok";
      }

      return p.risk === riskFilter;
    });

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Hasta Listesi</h1>

      <PatientsToolbar
        search={search}
        onSearchChange={setSearch}
        risk={riskFilter}
        onRiskChange={setRiskFilter}
      />

      <PatientTable patients={filteredPatients} />
    </div>
  );
}
