"use client";

import type { Locale } from "@/lib/i18n/config";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/components/providers/i18n-provider";

const OPTIONS: Array<{ value: Locale; labelKey: string }> = [
  { value: "tr", labelKey: "common.turkish" },
  { value: "en", labelKey: "common.english" },
];

export function LanguageSwitcher() {
  const router = useRouter();
  const { locale, setLocale, t } = useTranslation();

  return (
    <label className="inline-flex items-center gap-2 rounded-full border border-[var(--retina-border)] bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm">
      <span>{t("common.language")}</span>
      <select
        value={locale}
        onChange={(event) => {
          setLocale(event.target.value as Locale);
          // Refresh server components so SSR text follows new locale immediately.
          router.refresh();
        }}
        className="bg-transparent text-xs font-semibold text-[var(--retina-primary)] outline-none"
        aria-label={t("common.language")}
      >
        {OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {t(option.labelKey)}
          </option>
        ))}
      </select>
    </label>
  );
}
