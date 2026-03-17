"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { FileText, Save, Moon } from "lucide-react";

export default function SettingsPage() {
  // State tanımlamaları ve localStorage'dan başlangıç değerlerini alma
  const [darkMode, setDarkMode] = useState(false);
  const [reportTitle, setReportTitle] = useState(
    "Dr. Ahmet Yılmaz - Retina Analiz Merkezi",
  );
  const [includeDoctorNotes, setIncludeDoctorNotes] = useState(true);

  // Sayfa yüklendiğinde kayıtlı ayarları yükle
  useEffect(() => {
    const savedDarkMode = localStorage.getItem("darkMode") === "true";
    const savedTitle = localStorage.getItem("reportTitle");
    const savedNotes = localStorage.getItem("includeDoctorNotes") !== "false"; // Varsayılan true

    setDarkMode(savedDarkMode);
    if (savedTitle) setReportTitle(savedTitle);
    setIncludeDoctorNotes(savedNotes);

    // Dark mode sınıfını uygula
    if (savedDarkMode) {
      document.documentElement.classList.add("dark");
    }
  }, []);

  // Gece modu geçişi
  const handleDarkModeToggle = (checked: boolean) => {
    setDarkMode(checked);
    if (checked) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  // Ayarları Kaydetme (LocalStorage)
  const handleSaveSettings = () => {
    localStorage.setItem("darkMode", darkMode.toString());
    localStorage.setItem("reportTitle", reportTitle);
    localStorage.setItem("includeDoctorNotes", includeDoctorNotes.toString());

    alert("Ayarlar başarıyla kaydedildi ve sisteme uygulandı!");
  };

  return (
    <div className="clinic-app-bg mx-auto max-w-4xl space-y-8 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Sistem Ayarları
        </h1>
        <p className="text-sm text-slate-600">
          Uygulamanın raporlama ve görünüm ayarlarını yönetin.
        </p>
      </div>

      <div className="grid gap-6">
        {/* Raporlama Ayarları */}
        <Card className="border border-[#d8e0df] bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center gap-4">
            <div className="rounded-lg bg-[#dceaf2] p-2 text-[#5f90ad]">
              <FileText size={20} />
            </div>
            <div>
              <CardTitle>Raporlama Tercihleri</CardTitle>
              <CardDescription>
                Oluşturulan PDF raporlarının içeriğini belirleyin.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="report-title">
                Rapor Başlığı (Klinik/Doktor Adı)
              </Label>
              <Input
                id="report-title"
                placeholder="Örn: Dr. Ahmet Yılmaz"
                value={reportTitle}
                onChange={(e) => setReportTitle(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-[#d8e0df] bg-[#f6f9f8] p-3">
              <div className="space-y-0.5">
                <Label>Doktor Notlarını Dahil Et</Label>
                <p className="text-xs text-muted-foreground">
                  Yazdığınız manuel yorumları rapora ekler.
                </p>
              </div>
              <Switch
                checked={includeDoctorNotes}
                onCheckedChange={setIncludeDoctorNotes}
              />
            </div>
          </CardContent>
        </Card>

        {/* Görünüm Ayarları */}
        <Card className="border border-[#d8e0df] bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center gap-4">
            <div className="rounded-lg bg-[#efe7da] p-2 text-[#8b6a49]">
              <Moon size={20} />
            </div>
            <div>
              <CardTitle>Görünüm Tercihleri</CardTitle>
              <CardDescription>
                Arayüz temasını kişiselleştirin.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between rounded-lg border border-[#d8e0df] bg-[#f6f9f8] p-3">
              <div className="space-y-0.5">
                <Label>Gece Modu</Label>
                <p className="text-xs text-muted-foreground">
                  Sistemi koyu renk şemasına geçirir.
                </p>
              </div>
              <Switch
                checked={darkMode}
                onCheckedChange={handleDarkModeToggle}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end pt-4">
        <Button
          className="gap-2 bg-[#659f92] px-8 text-white hover:bg-[#84b9ad]"
          onClick={handleSaveSettings}
        >
          <Save size={18} /> Ayarları Kaydet
        </Button>
      </div>
    </div>
  );
}
