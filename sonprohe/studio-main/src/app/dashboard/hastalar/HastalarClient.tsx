"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Calendar, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Patient = {
  id: string;
  fullName: string;
  tcNo: string;
  createdAt: string;
  risk?: string;
  aiResult?: string;
  drFeedback?: string | (string | null)[]; // array veya string olabilir
};

export default function HastalarClient({ patients }: { patients: Patient[] }) {
  const [search, setSearch] = useState("");

  const filteredPatients = patients.filter(
    (patient) =>
      patient.fullName.toLowerCase().includes(search.toLowerCase()) ||
      patient.tcNo.includes(search),
  );

  const getRiskStyle = (risk?: string) => {
    if (!risk) {
      return {
        label: "ANALİZ BEKLİYOR",
        className: "bg-slate-100 text-slate-500 border-slate-200",
      };
    }

    switch (risk) {
      case "Proliferative_DR":
      case "Çok İleri Evre":
        return {
          label: "ÇOK YÜKSEK RİSK",
          className: "bg-amber-100/80 text-amber-700 border-amber-200",
        };
      case "Ağır Evre":
      case "Severe":
        return {
          label: "YÜKSEK RİSK",
          className: "bg-amber-100/80 text-amber-700 border-amber-200",
        };
      case "Moderate":
      case "Orta Evre":
        return {
          label: "ORTA RİSK",
          className: "bg-[#efe7da] text-[#8b6a49] border-[#d9cab5]",
        };
      case "Mild":
      case "Hafif Evre":
        return {
          label: "DÜŞÜK RİSK",
          className: "bg-[#e8f2ef] text-[#5b8d82] border-[#cfe0dc]",
        };
      case "No_DR":
      case "Healthy":
      case "Sağlıklı":
        return {
          label: "SAĞLIKLI",
          className: "bg-[#dff0ea] text-[#4c8a7d] border-[#c5ddd6]",
        };
      default:
        return {
          label: "ANALİZ BEKLİYOR",
          className: "bg-slate-100 text-slate-500 border-slate-200",
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Arama çubuğu */}
      <div className="relative group mx-auto max-w-2xl md:mx-0">
        <div className="absolute -inset-0.5 rounded-xl bg-[#dfe7e6]"></div>
        <div className="relative flex items-center rounded-xl bg-white shadow-sm">
          <Search className="absolute left-4 h-5 w-5 text-[#7f98a6]" />
          <Input
            placeholder="Hasta adı veya TC Kimlik No ile arama..."
            className="pl-12 h-14 border-none bg-transparent text-lg focus-visible:ring-0 placeholder:text-slate-400/80"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Liste */}
      <div className="grid gap-4">
        {filteredPatients.length > 0 ? (
          filteredPatients.map((patient) => {
            // drFeedback array ise içindeki null'u temizle, string ise direkt kullan
            let cleanDrFeedback: string | undefined = undefined;
            if (Array.isArray(patient.drFeedback)) {
              const firstValid = patient.drFeedback.find(
                (v) => v !== null && v !== "null",
              );
              cleanDrFeedback = firstValid ?? undefined;
            } else if (
              typeof patient.drFeedback === "string" &&
              patient.drFeedback !== "null"
            ) {
              cleanDrFeedback = patient.drFeedback;
            }

            // Öncelik: drFeedback > aiResult > risk
            const finalRisk =
              cleanDrFeedback ?? patient.aiResult ?? patient.risk;
            const riskInfo = getRiskStyle(finalRisk);

            return (
              <div
                key={patient.id}
                className="group relative flex flex-col items-center justify-between rounded-2xl border border-[#d8e0df] bg-white p-5 md:flex-row"
              >
                {/* Sol taraf: Avatar & Bilgi */}
                <div className="flex items-center gap-5 w-full md:w-auto">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#dceaf2] text-xl font-bold text-[#5f90ad]">
                    {patient.fullName
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .substring(0, 2)
                      .toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">
                      {patient.fullName}
                    </h3>
                    <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                      <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 tracking-wider text-xs border border-slate-200">
                        {patient.tcNo}
                      </span>
                      <span className="hidden md:flex items-center gap-1 text-slate-400 text-xs">
                        <Calendar size={12} />
                        {new Date(patient.createdAt).toLocaleDateString(
                          "tr-TR",
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Sağ taraf: Risk & Buton */}
                <div className="flex items-center gap-6 w-full md:w-auto mt-4 md:mt-0 justify-between md:justify-end">
                  <Badge
                    variant="outline"
                    className={`px-3 py-1 text-xs font-bold tracking-wide ${riskInfo.className}`}
                  >
                    {riskInfo.label}
                  </Badge>

                  <Button
                    asChild
                    size="sm"
                    className="rounded-full border border-[#cfd8d7] bg-[#f7f9f8] text-[#476775] hover:bg-[#e8eff2] hover:text-[#2f4957] shadow-sm"
                  >
                    <Link
                      href={`/dashboard/hastalar/${patient.id}`}
                      className="flex items-center gap-1 px-4"
                    >
                      Detay <ChevronRight size={14} />
                    </Link>
                  </Button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-[#cfd8d7] bg-white py-20">
            <div className="h-16 w-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <Search className="text-slate-400 h-8 w-8" />
            </div>
            <p className="text-lg font-medium text-slate-600">
              Sonuç Bulunamadı
            </p>
            <p className="text-sm text-slate-400">
              Aradığınız kriterlere uygun hasta kaydı yok.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
