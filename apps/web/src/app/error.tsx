"use client";

import { useEffect } from "react";
import { logStructuredError } from "@/lib/structured-error-log";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logStructuredError({
      requestId: "client-error-boundary",
      route:
        typeof window !== "undefined"
          ? window.location.pathname
          : "unknown",
      action: "SERVER_COMPONENT_RENDER",
      errorMessage: error.message,
      stack: error.stack,
      digest: error.digest,
    });
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-4 p-8 text-center">
      <h2 className="text-lg font-semibold text-slate-900">
        Sayfa yüklenirken bir hata oluştu
      </h2>
      <p className="text-sm text-slate-600">
        Sorun devam ederse yöneticinize başvurun.
      </p>
      <Button type="button" onClick={() => reset()}>
        Tekrar dene
      </Button>
    </div>
  );
}
