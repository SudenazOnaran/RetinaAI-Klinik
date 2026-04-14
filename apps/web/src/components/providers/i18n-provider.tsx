"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Locale } from "@/lib/i18n/config";
import { LOCALE_COOKIE_NAME } from "@/lib/i18n/config";
import enMessages from "@/messages/en.json";
import trMessages from "@/messages/tr.json";

type Messages = typeof trMessages;

const MESSAGES_BY_LOCALE: Record<Locale, Messages> = {
  tr: trMessages,
  en: enMessages,
};

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function resolveMessage(messages: Messages, key: string): string | undefined {
  const parts = key.split(".");
  let current: unknown = messages;

  for (const part of parts) {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return typeof current === "string" ? current : undefined;
}

function interpolate(
  input: string,
  params?: Record<string, string | number>,
): string {
  if (!params) return input;

  return Object.entries(params).reduce((acc, [key, value]) => {
    return acc.replaceAll(`{{${key}}}`, String(value));
  }, input);
}

export function I18nProvider({
  children,
  initialLocale,
}: {
  children: ReactNode;
  initialLocale: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale);
    document.cookie = `${LOCALE_COOKIE_NAME}=${nextLocale}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    try {
      localStorage.setItem(LOCALE_COOKIE_NAME, nextLocale);
    } catch {
      // localStorage kapaliysa cookie yeterli.
    }
  }, []);

  const value = useMemo<I18nContextValue>(() => {
    const currentMessages = MESSAGES_BY_LOCALE[locale];
    return {
      locale,
      setLocale,
      t: (key, params) => {
        const fallback = resolveMessage(trMessages, key) ?? key;
        const template = resolveMessage(currentMessages, key) ?? fallback;
        return interpolate(template, params);
      },
    };
  }, [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useTranslation must be used within I18nProvider.");
  }
  return ctx;
}
