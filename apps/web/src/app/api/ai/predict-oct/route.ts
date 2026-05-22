import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentDoctorSession, getMobileDoctorSession } from "@/lib/auth-session";
import { enqueueAiRequest, callAiOctServiceWithRetry } from "@/lib/ai-gateway";
import { logAuditEvent } from "@/lib/audit-log";
import { createMonitoringAlert } from "@/lib/monitoring-alerts";
import {
  formatErrorCause,
  logStructuredError,
} from "@/lib/structured-error-log";
import { aiFailureShouldBypassQueue } from "@/lib/ai-gateway-queue-policy";
import { resolveAiUploadFilename } from "@/lib/ai-upload-filename";

export const runtime = "nodejs";

function statusFromAiGatewayError(message: string): number {
  const hit = message.match(/\((\d{3})\)\s*:/);
  if (hit) {
    const code = Number.parseInt(hit[1], 10);
    if (Number.isFinite(code) && code >= 400 && code < 600) return code;
  }
  return 503;
}

function userVisibleMessageFromGatewayError(message: string): string {
  const colonIdx = message.indexOf(": ");
  if (colonIdx === -1) return message;
  const rest = message.slice(colonIdx + 2).trim();
  if (rest.startsWith("{")) {
    try {
      const j = JSON.parse(rest) as { error?: string };
      if (typeof j.error === "string" && j.error.trim()) return j.error.trim();
    } catch {
      /* tam JSON degil */
    }
  }
  if (rest.length > 600) return `${rest.slice(0, 600)}…`;
  return rest || message;
}

type OctSuccess = {
  success: true;
  oct?: unknown;
};

export async function POST(req: Request) {
  const session =
    getMobileDoctorSession(req) ?? (await getCurrentDoctorSession());
  if (!session) {
    return NextResponse.json({ error: "Oturum bulunamadi" }, { status: 401 });
  }

  const requestId = req.headers.get("x-request-id")?.trim() || randomUUID();

  const body = await req.formData();
  const file = body.get("image");
  const patientId = String(body.get("patientId") || "").trim() || null;
  const locale = String(body.get("locale") || "en").trim() || "en";

  if (!(file instanceof File)) {
    return NextResponse.json(
      { success: false, error: "Gorsel dosyasi bulunamadi." },
      { status: 400 },
    );
  }

  const upstreamForm = new FormData();
  upstreamForm.append(
    "image",
    file,
    resolveAiUploadFilename(file, "oct"),
  );
  upstreamForm.append("locale", locale);
  if (patientId) {
    upstreamForm.append("patientId", patientId);
  }

  try {
    const aiData = (await callAiOctServiceWithRetry(upstreamForm, {
      requestId,
      route: "/api/ai/predict-oct",
      action: "AI_OCT_ANALYZE",
      patientId,
    })) as OctSuccess;

    await logAuditEvent({
      doctorId: session.id,
      role: session.role,
      action: "VIEW",
      entityType: "ANALYSIS",
      entityId: patientId,
      description: "Makula OCT AI analiz istegi basariyla tamamlandi",
      metadata: {
        patientId,
        kind: "oct",
      },
    });

    return NextResponse.json(aiData, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI servis hatasi";

    if (aiFailureShouldBypassQueue(message)) {
      const visible = userVisibleMessageFromGatewayError(message);
      return NextResponse.json(
        {
          success: false,
          queued: false,
          error: visible,
        },
        { status: statusFromAiGatewayError(message) },
      );
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      const imageBase64 = Buffer.from(arrayBuffer).toString("base64");

      const queueId = await enqueueAiRequest({
        doctorId: session.id,
        endpoint: "/predict-oct",
        error: message,
        payload: {
          patientId,
          fileName: file.name || "oct.jpg",
          mimeType: file.type || "application/octet-stream",
          imageBase64,
          queuedByDoctorId: session.id,
        },
      });

      await createMonitoringAlert({
        doctorId: session.id,
        source: "AI_GATEWAY",
        severity: "CRITICAL",
        title: "Makula OCT AI servisine ulasilamiyor",
        detail: "OCT analiz istegi kuyruga alindi",
        metadata: {
          queueId,
          reason: message,
          patientId,
        },
      });

      await logAuditEvent({
        doctorId: session.id,
        role: session.role,
        action: "EDIT",
        entityType: "SYSTEM",
        entityId: queueId,
        description: "Makula OCT AI istegi kuyruga alindi",
        metadata: {
          reason: message,
          patientId,
        },
      });

      return NextResponse.json(
        {
          success: false,
          queued: true,
          queueId,
          error:
            "AI servisine su an ulasilamadi. Istek kuyruga alindi, daha sonra tekrar denenebilir.",
        },
        { status: 202 },
      );
    } catch (secondary) {
      logStructuredError({
        requestId,
        route: "/api/ai/predict-oct",
        action: "AI_OCT_QUEUE_FAIL",
        patientId,
        errorMessage:
          secondary instanceof Error ? secondary.message : String(secondary),
        stack: secondary instanceof Error ? secondary.stack : undefined,
        cause: formatErrorCause(secondary),
        payloadSummary: JSON.stringify({
          fileName: file.name || "oct.jpg",
          mimeType: file.type || "application/octet-stream",
          fileSize: file.size,
          priorErrorLen: message.length,
        }),
      });
      return NextResponse.json(
        { success: false, error: "AI istegi kuyruga alinamadi." },
        { status: 500 },
      );
    }
  }
}
