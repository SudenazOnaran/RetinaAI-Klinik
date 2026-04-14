"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useTranslation } from "@/components/providers/i18n-provider";

export function LogoutButton() {
  const router = useRouter();
  const { t } = useTranslation();

  const handleLogout = async () => {
    await fetch("/api/doctor/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="inline-flex items-center gap-2 rounded-full border border-[var(--retina-border)] bg-white px-4 py-1.5 text-sm font-semibold text-[var(--retina-primary)] shadow-sm transition hover:bg-[var(--retina-background)]"
    >
      <LogOut className="h-4 w-4" /> {t("dashboard.logout")}
    </button>
  );
}
