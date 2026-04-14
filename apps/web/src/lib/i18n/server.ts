import { cookies, headers } from "next/headers";
import trMessages from "@/messages/tr.json";
import enMessages from "@/messages/en.json";
import {
  DEFAULT_LOCALE,
  type Locale,
  LOCALE_COOKIE_NAME,
  isLocale,
  normalizeLocale,
} from "@/lib/i18n/config";

export type Messages = typeof trMessages;

const MESSAGES_BY_LOCALE: Record<Locale, Messages> = {
  tr: trMessages,
  en: enMessages,
};

function getLocaleFromAcceptLanguage(headerValue?: string | null): Locale {
  if (!headerValue) return DEFAULT_LOCALE;

  const languages = headerValue
    .split(",")
    .map((part) => part.trim().split(";")[0])
    .filter(Boolean);

  for (const language of languages) {
    const locale = normalizeLocale(language);
    if (locale === "tr" || locale === "en") {
      return locale;
    }
  }

  return DEFAULT_LOCALE;
}

export async function getRequestLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  if (isLocale(cookieLocale)) {
    return cookieLocale;
  }

  const headerStore = await headers();
  return getLocaleFromAcceptLanguage(headerStore.get("accept-language"));
}

export async function getRequestMessages(): Promise<Messages> {
  const locale = await getRequestLocale();
  return MESSAGES_BY_LOCALE[locale];
}
