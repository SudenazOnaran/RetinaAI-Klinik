export type StructuredErrorLog = {
  timestamp: string;
  requestId: string;
  service: "nextjs" | "flask";
  route: string;
  action: string;
  patientId?: string | null;
  analysisId?: string | null;
  errorMessage: string;
  stack?: string;
  cause?: string;
  digest?: string;
  aiResponseSummary?: string;
  payloadSummary?: string;
};

export function formatErrorCause(err: unknown): string | undefined {
  if (!(err instanceof Error) || !err.cause) return undefined;
  return err.cause instanceof Error
    ? err.cause.message
    : String(err.cause);
}

/** Kısa özet; ham görüntü / base64 / token içermez. */
export function summarizeSaveAnalysisPayload(input: {
  doctorNoteLen: number;
  ilaclarLen: number;
  hasHeatmap: boolean;
  hasOriginalImage: boolean;
  hasOctImage?: boolean;
  hasFfaImage?: boolean;
  aiResultLen: number;
  labelsCount: number;
}): string {
  return JSON.stringify({
    doctorNoteLen: input.doctorNoteLen,
    ilaclarLen: input.ilaclarLen,
    hasHeatmap: input.hasHeatmap,
    hasOriginalImage: input.hasOriginalImage,
    hasOctImage: input.hasOctImage,
    hasFfaImage: input.hasFfaImage,
    aiResultLen: input.aiResultLen,
    labelsCount: input.labelsCount,
  });
}

export function logStructuredError(
  entry: Omit<StructuredErrorLog, "timestamp" | "service"> & {
    service?: StructuredErrorLog["service"];
  },
): void {
  const payload: StructuredErrorLog = {
    timestamp: new Date().toISOString(),
    service: entry.service ?? "nextjs",
    requestId: entry.requestId,
    route: entry.route,
    action: entry.action,
    patientId: entry.patientId,
    analysisId: entry.analysisId,
    errorMessage: entry.errorMessage,
    stack: entry.stack,
    cause: entry.cause,
    digest: entry.digest,
    aiResponseSummary: entry.aiResponseSummary,
    payloadSummary: entry.payloadSummary,
  };
  console.error(JSON.stringify(payload));
}
