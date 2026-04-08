import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/toaster";
import { SETTINGS_STORAGE_KEY } from "@/lib/retina-settings";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Retina AI",
  description: "Profesyonel bir klinik web sitesi",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
    <html lang="tr" suppressHydrationWarning>
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
        {children}

        <Toaster />
      </body>
    </html>
  );
}
