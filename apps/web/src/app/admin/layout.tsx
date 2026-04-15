"use client";

import { useRouter } from "next/navigation";
import { Eye, LogOut, ShieldCheck } from "lucide-react";
import { useTranslation } from "@/components/providers/i18n-provider";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/doctor/logout", { method: "POST" });
    router.replace("/login");
  };

  return (
    <div className="clinic-app-bg min-h-screen">
      <header className="sticky top-0 z-10 border-b border-[var(--retina-border)] bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#0a2540] to-[#1e90ff]">
              <Eye className="h-5 w-5 text-white" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-lg font-black leading-none tracking-tight text-slate-900">
                RETİNA{" "}
                <span className="text-[var(--retina-secondary)]">
                  {t("adminLayout.admin")}
                </span>
              </h1>
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                {t("adminLayout.panel")}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700">
              <ShieldCheck className="h-4 w-4" />
              {t("adminLayout.admin")}
            </div>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <LogOut className="h-4 w-4" />
              {t("adminLayout.logout")}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-6">{children}</main>
    </div>
  );
}
