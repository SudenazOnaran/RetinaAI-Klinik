export const LOCALE_COOKIE_NAME = "retina_locale";

export const SUPPORTED_LOCALES = ["tr", "en"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "tr";

export function isLocale(value?: string | null): value is Locale {
  return value === "tr" || value === "en";
}

export function normalizeLocale(value?: string | null): Locale {
  if (!value) return DEFAULT_LOCALE;
  const lowered = value.toLowerCase();
  if (lowered === "tr" || lowered.startsWith("tr-")) return "tr";
  if (lowered === "en" || lowered.startsWith("en-")) return "en";
  return DEFAULT_LOCALE;
}
