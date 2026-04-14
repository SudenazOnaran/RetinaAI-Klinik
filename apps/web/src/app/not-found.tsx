"use client";

import Link from "next/link";
import { useTranslation } from "@/components/providers/i18n-provider";

export default function NotFound() {
  const { t } = useTranslation();

  return (
    <div className="clinic-app-bg flex min-h-screen items-center justify-center px-6">
      <div className="clinic-panel max-w-lg rounded-2xl p-8 text-center">
        <h1 className="text-3xl font-bold text-slate-900">{t("notFound.title")}</h1>
        <p className="mt-3 text-sm text-slate-600">{t("notFound.description")}</p>
        <Link
          href="/login"
          className="mt-6 inline-flex rounded-lg bg-[var(--retina-primary)] px-4 py-2 text-sm font-semibold text-white"
        >
          {t("notFound.backHome")}
        </Link>
      </div>
    </div>
  );
}
