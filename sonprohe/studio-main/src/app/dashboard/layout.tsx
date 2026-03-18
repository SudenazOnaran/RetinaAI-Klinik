"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, PanelLeft } from "lucide-react";
import {
  loadRetinaSettingsFromStorage,
  RetinaSettings,
} from "@/lib/retina-settings";
import { RetinaAiLogo } from "@/components/icons/logo";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { LogoutButton } from "@/components/layout/logout-button";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isPatientDetail = pathname.startsWith("/dashboard/hastalar/");
  const isCalendarPage = pathname.startsWith("/dashboard/takvim");

  useEffect(() => {
    const applyAppearance = (settings: RetinaSettings) => {
      document.documentElement.classList.toggle(
        "dark",
        settings.appearance.darkMode,
      );
    };

    applyAppearance(loadRetinaSettingsFromStorage());

    const onSettingsUpdated = (event: Event) => {
      const custom = event as CustomEvent<RetinaSettings>;
      if (custom.detail) {
        applyAppearance(custom.detail);
      }
    };

    window.addEventListener(
      "retina-settings-updated",
      onSettingsUpdated as EventListener,
    );

    return () => {
      window.removeEventListener(
        "retina-settings-updated",
        onSettingsUpdated as EventListener,
      );
    };
  }, []);

  return (
    <div className="clinic-app-bg mx-auto flex min-h-screen w-full">
      <SidebarProvider
        defaultOpen
        style={{
          ["--sidebar-width" as string]: "280px",
        }}
      >
        <Sidebar className="overflow-hidden border-r border-[var(--retina-border)] bg-white shadow-sm">
          <SidebarHeader className="border-b border-[var(--retina-border)] bg-[#f2f7ff]">
            <div className="flex items-center gap-3 p-5 relative">
              <RetinaAiLogo className="h-10 w-10 text-[var(--retina-primary)]" />
              <div className="flex flex-col">
                <h1 className="text-xl font-black leading-none tracking-tight text-slate-900">
                  RETINA{" "}
                  <span className="text-[var(--retina-secondary)]">CLINIC</span>
                </h1>
                <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Fundus Klinik Takip Sistemi
                </span>
              </div>
            </div>
          </SidebarHeader>
          <SidebarContent className="px-3 py-6 custom-scrollbar">
            <SidebarNav />
          </SidebarContent>
        </Sidebar>
        <SidebarInset className="flex flex-1 flex-col bg-transparent">
          <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b border-[var(--retina-border)] bg-white/95 px-6">
            <SidebarTrigger className="rounded-full p-2 hover:bg-[#f0f6ff]">
              <PanelLeft className="h-5 w-5 text-slate-600" />
            </SidebarTrigger>

            <div className="mx-2 h-6 w-[1px] bg-[var(--retina-border)]" />

            {isPatientDetail && (
              <Link
                href="/dashboard/hastalar"
                className="group flex items-center gap-2 rounded-full border border-[var(--retina-border)] bg-[#f2f7ff] px-4 py-1.5 text-sm font-medium text-[var(--retina-primary)] shadow-sm"
              >
                <ArrowLeft className="h-4 w-4" />
                Hasta Listesi
              </Link>
            )}

            <div className="ml-auto">
              <LogoutButton />
            </div>
          </header>

          <main
            className={`flex-1 ${isCalendarPage ? "p-3 md:p-4" : "p-6 md:p-8"}`}
          >
            <div
              className={`mx-auto w-full ${isCalendarPage ? "max-w-none" : "max-w-7xl"}`}
            >
              {children}
            </div>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
