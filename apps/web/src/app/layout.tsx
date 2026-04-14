import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/toaster";
import { SETTINGS_STORAGE_KEY } from "@/lib/retina-settings";
import { I18nProvider } from "@/components/providers/i18n-provider";
import { getRequestLocale, getRequestMessages } from "@/lib/i18n/server";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export async function generateMetadata(): Promise<Metadata> {
  const messages = await getRequestMessages();
  return {
    title: messages.meta.title,
    description: messages.meta.description,
    alternates: {
      languages: {
        tr: "/",
        en: "/",
      },
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getRequestLocale();
  const bootstrapAppearanceScript = `
    (function () {
      try {
        var raw = localStorage.getItem("${SETTINGS_STORAGE_KEY}");
        if (!raw) return;
        var parsed = JSON.parse(raw);
        var darkMode = !!parsed?.appearance?.darkMode;
        document.documentElement.classList.toggle("dark", darkMode);
      } catch (_) {}
    })();
  `;

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: bootstrapAppearanceScript }}
        />
      </head>
      <body
        className={cn(
          "clinic-app-bg relative min-h-screen font-sans antialiased",
          inter.variable,
        )}
      >
        <I18nProvider initialLocale={locale}>{children}</I18nProvider>

        <Toaster />
      </body>
    </html>
  );
}
