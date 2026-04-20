"use client";

import { useEffect } from "react";
import { logStructuredError } from "@/lib/structured-error-log";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logStructuredError({
      requestId: "global-error-boundary",
      route: "global",
      action: "ROOT_LAYOUT_ERROR",
      errorMessage: error.message,
      stack: error.stack,
      digest: error.digest,
    });
  }, [error]);

  return (
    <html lang="tr">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white p-8 text-center font-sans">
        <h2 className="text-lg font-semibold text-slate-900">
          Uygulama yüklenirken kritik bir hata oluştu
        </h2>
        <button
          type="button"
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
          onClick={() => reset()}
        >
          Tekrar dene
        </button>
      </body>
    </html>
  );
}
