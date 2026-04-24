import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentDoctorSession } from "@/lib/auth-session";
import { enqueueAiRequest, callAiServiceWithRetry } from "@/lib/ai-gateway";
import { logAuditEvent } from "@/lib/audit-log";
import { createMonitoringAlert } from "@/lib/monitoring-alerts";
import {
  formatErrorCause,
  logStructuredError,
} from "@/lib/structured-error-log";

export const runtime = "nodejs";

/** AI servisi dondugunde kuyruk "sonra duzelir" degildir; kullaniciya dogrudan mesaj gosterilir. */
function aiFailureShouldBypassQueue(message: string): boolean {
  const m = message.toLowerCase();
  return (
    /\((429|401|400|403|502|503)\)\s*:/.test(message) ||
    m.includes("quota") ||
    m.includes("ucretsiz kota") ||
    m.includes("resource_exhausted") ||
    m.includes("geminiquotaexceeded")
  );
}

function statusFromAiGatewayError(message: string): number {
  const hit = message.match(/\((\d{3})\)\s*:/);
  if (hit) {
    const code = Number.parseInt(hit[1], 10);
    if (Number.isFinite(code) && code >= 400 && code < 600) return code;
  }
  return 503;
}

/** Gateway: `AI servisi hatasi (429): {"error":"..."}` -> kullanici metni */
function userVisibleMessageFromGatewayError(message: string): string {
  const colonIdx = message.indexOf(": ");
  if (colonIdx === -1) return message;
  const rest = message.slice(colonIdx + 2).trim();
  if (rest.startsWith("{")) {
    try {
      const j = JSON.parse(rest) as { error?: string };
      if (typeof j.error === "string" && j.error.trim()) return j.error.trim();
    } catch {
      /* tam JSON degil (kisaltilmis olabilir) */
    }
  }
  if (rest.length > 600) return `${rest.slice(0, 600)}…`;
  return rest || message;
}

type PredictSuccess = {
  success: true;
  drGrade?: number;
  pytorch: {
    label: string;
    confidence: number;
  };
};

export async function POST(req: Request) {
  const session = await getCurrentDoctorSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum bulunamadi" }, { status: 401 });
  }

  const requestId = req.headers.get("x-request-id")?.trim() || randomUUID();

  const body = await req.formData();
  const file = body.get("image");
  const patientId = String(body.get("patientId") || "").trim() || null;

  if (!(file instanceof File)) {
    return NextResponse.json(
      { success: false, error: "Gorsel dosyasi bulunamadi." },
      { status: 400 },
    );
  }

  const upstreamForm = new FormData();
  upstreamForm.append("image", file, file.name || "image.jpg");

  const roiMask = body.get("roiMask");
  if (roiMask instanceof File) {
    upstreamForm.append("roiMask", roiMask, roiMask.name || "roi-mask.png");
  }

  try {
    const aiData = (await callAiServiceWithRetry(upstreamForm, {
      requestId,
      route: "/api/ai/predict",
      action: "AI_ANALYZE",
      patientId,
    })) as PredictSuccess;

    await logAuditEvent({
      doctorId: session.id,
      role: session.role,
      action: "VIEW",
      entityType: "ANALYSIS",
      entityId: patientId,
      description: "AI analiz istegi basariyla tamamlandi",
      metadata: {
        patientId,
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
        endpoint: "/predict",
        error: message,
        payload: {
          patientId,
          fileName: file.name || "image.jpg",
          mimeType: file.type || "application/octet-stream",
          imageBase64,
          queuedByDoctorId: session.id,
        },
      });

      await createMonitoringAlert({
        doctorId: session.id,
        source: "AI_GATEWAY",
        severity: "CRITICAL",
        title: "AI servisi ulasilamiyor",
        detail: "AI analiz istegi kuyruga alindi",
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
        description: "AI istegi kuyruga alindi",
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
        route: "/api/ai/predict",
        action: "AI_ANALYZE_QUEUE_FAIL",
        patientId,
        errorMessage:
          secondary instanceof Error ? secondary.message : String(secondary),
        stack: secondary instanceof Error ? secondary.stack : undefined,
        cause: formatErrorCause(secondary),
        payloadSummary: JSON.stringify({
          fileName: file.name || "image.jpg",
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
