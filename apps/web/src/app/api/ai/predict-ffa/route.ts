import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentDoctorSession, getMobileDoctorSession } from "@/lib/auth-session";
import { enqueueAiRequest, callAiFfaServiceWithRetry } from "@/lib/ai-gateway";
import { logAuditEvent } from "@/lib/audit-log";
import { createMonitoringAlert } from "@/lib/monitoring-alerts";
import {
  formatErrorCause,
  logStructuredError,
} from "@/lib/structured-error-log";
import { aiFailureShouldBypassQueue } from "@/lib/ai-gateway-queue-policy";

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

type FfaSuccess = {
  success: true;
  ffa?: unknown;
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
  upstreamForm.append("image", file, file.name || "ffa.jpg");
  upstreamForm.append("locale", locale);
  if (patientId) {
    upstreamForm.append("patientId", patientId);
  }

  try {
    const aiData = (await callAiFfaServiceWithRetry(upstreamForm, {
      requestId,
      route: "/api/ai/predict-ffa",
      action: "AI_FFA_ANALYZE",
      patientId,
    })) as FfaSuccess;

    await logAuditEvent({
      doctorId: session.id,
      role: session.role,
      action: "VIEW",
      entityType: "ANALYSIS",
      entityId: patientId,
      description: "FFA AI analiz istegi basariyla tamamlandi",
      metadata: {
        patientId,
        kind: "ffa",
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
        endpoint: "/predict-ffa",
        error: message,
        payload: {
          patientId,
          fileName: file.name || "ffa.jpg",
          mimeType: file.type || "application/octet-stream",
          imageBase64,
          queuedByDoctorId: session.id,
        },
      });

      await createMonitoringAlert({
        doctorId: session.id,
        source: "AI_GATEWAY",
        severity: "CRITICAL",
        title: "FFA AI servisine ulasilamiyor",
        detail: "FFA analiz istegi kuyruga alindi",
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
        description: "FFA AI istegi kuyruga alindi",
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
        route: "/api/ai/predict-ffa",
        action: "AI_FFA_QUEUE_FAIL",
        patientId,
        errorMessage:
          secondary instanceof Error ? secondary.message : String(secondary),
        stack: secondary instanceof Error ? secondary.stack : undefined,
        cause: formatErrorCause(secondary),
        payloadSummary: JSON.stringify({
          fileName: file.name || "ffa.jpg",
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
