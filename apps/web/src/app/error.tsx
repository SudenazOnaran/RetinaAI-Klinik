"use client";

import Link from "next/link";
import { useTranslation } from "@/components/providers/i18n-provider";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="clinic-app-bg flex min-h-screen items-center justify-center px-6">
      <div className="clinic-panel max-w-lg rounded-2xl p-8 text-center">
        <h1 className="text-3xl font-bold text-slate-900">{t("errorPage.title")}</h1>
        <p className="mt-3 text-sm text-slate-600">{t("errorPage.description")}</p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-lg bg-[var(--retina-primary)] px-4 py-2 text-sm font-semibold text-white"
          >
            {t("errorPage.retry")}
          </button>
          <Link
            href="/login"
            className="rounded-lg border border-[var(--retina-border)] bg-white px-4 py-2 text-sm font-semibold text-slate-700"
          >
            {t("errorPage.goHome")}
          </Link>
        </div>
      </div>
    </div>
  );
}
