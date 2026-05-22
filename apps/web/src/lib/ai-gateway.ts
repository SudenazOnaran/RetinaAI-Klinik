import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { formatAiUpstreamErrorBody } from "@/lib/ai-upstream-error";
import { logStructuredError } from "@/lib/structured-error-log";

type QueuePayload = {
  patientId?: string | null;
  fileName: string;
  mimeType: string;
  imageBase64: string;
  queuedByDoctorId: string;
};

export async function enqueueAiRequest(input: {
  doctorId: string;
  endpoint: string;
  payload: QueuePayload;
  error?: string;
}) {
  const id = randomUUID();
  const payloadJson = JSON.stringify(input.payload);

  await prisma.$executeRaw`
    INSERT INTO "AiRequestQueue" (
      "id",
      "doctorId",
      "status",
      "endpoint",
      "payload",
      "error",
      "attempts",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${id},
      ${input.doctorId},
      ${"PENDING"},
      ${input.endpoint},
      ${payloadJson}::jsonb,
      ${input.error ?? null},
      0,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
  `;

  return id;
}

function getAiServiceUrl() {
  return process.env.AI_SERVICE_URL || "http://localhost:5000/predict";
}

/** app_gemini.py varsayilan portu; OCT/FFA yalnizca bu serviste (/predict-oct, /predict-ffa). */
function getGeminiServicePort(): string {
  const raw = (process.env.AI_GEMINI_PORT || "5001").trim();
  return raw || "5001";
}

/**
 * Fundus bazi kurulumlarda app.py (Gunicorn, 5000) uzerinden calisir.
 * OCT/FFA endpoint'leri yalnizca app_gemini'de vardir — 5000'e turetilirse 404 alinir.
 */
function applyGeminiPortForModalityIfLegacyFundus(u: URL): void {
  const port = u.port || (u.protocol === "https:" ? "443" : "80");
  if (port === "5000") {
    u.port = getGeminiServicePort();
  }
}

function buildModalityServiceUrl(
  suffix: "predict-oct" | "predict-ffa",
  baseUrl: string,
): string {
  const u = new URL(baseUrl);
  applyGeminiPortForModalityIfLegacyFundus(u);
  const path = u.pathname.replace(/\/$/, "");
  if (path.endsWith("/predict")) {
    u.pathname = path.replace(/\/predict$/, `/${suffix}`);
  } else if (!path || path === "/") {
    u.pathname = `/${suffix}`;
  } else {
    u.pathname = `${path}/${suffix}`;
  }
  return u.toString();
}

/** Makula OCT: `AI_OCT_SERVICE_URL` veya `AI_SERVICE_URL` -> `/predict-oct` (Gemini portu). */
function getDerivedOctServiceUrl() {
  const explicit = (process.env.AI_OCT_SERVICE_URL || "").trim();
  if (explicit) return explicit;
  const base = process.env.AI_SERVICE_URL || "http://localhost:5000/predict";
  try {
    return buildModalityServiceUrl("predict-oct", base);
  } catch {
    return `http://127.0.0.1:${getGeminiServicePort()}/predict-oct`;
  }
}

/** FFA: `AI_FFA_SERVICE_URL` veya `AI_SERVICE_URL` -> `/predict-ffa` (Gemini portu). */
function getDerivedFfaServiceUrl() {
  const explicit = (process.env.AI_FFA_SERVICE_URL || "").trim();
  if (explicit) return explicit;
  const base = process.env.AI_SERVICE_URL || "http://localhost:5000/predict";
  try {
    return buildModalityServiceUrl("predict-ffa", base);
  } catch {
    return `http://127.0.0.1:${getGeminiServicePort()}/predict-ffa`;
  }
}

function getAiGatewaySecret() {
  const secret = process.env.AI_GATEWAY_SHARED_SECRET;
  if (!secret || !secret.trim()) {
    throw new Error(
      "AI_GATEWAY_SHARED_SECRET tanimli degil. AI gecidi guvenlik nedeniyle calismiyor.",
    );
  }
  return secret;
}

function getTimeoutMs() {
  const value = Number(process.env.AI_REQUEST_TIMEOUT_MS || "120000");
  if (!Number.isFinite(value) || value < 1000) return 120000;
  return value;
}

function getRetryCount() {
  const value = Number(process.env.AI_REQUEST_RETRY_COUNT ?? "2");
  if (!Number.isFinite(value) || value < 0) return 2;
  return Math.min(5, value);
}

function isLoopbackHost(hostname: string) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1"
  );
}

function shouldUseTlsEnforcement(targetUrl: URL) {
  if (process.env.NODE_ENV !== "production") return false;
  if (process.env.AI_ALLOW_HTTP_IN_PROD === "1") return false;
  if (isLoopbackHost(targetUrl.hostname)) return false;
  return true;
}

async function delay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export type AiGatewayCallContext = {
  requestId: string;
  route: string;
  action: string;
  patientId?: string | null;
};

function logAndThrow(ctx: AiGatewayCallContext, err: Error, extras?: { aiResponseSummary?: string; payloadSummary?: string }): never {
  logStructuredError({
    requestId: ctx.requestId,
    route: ctx.route,
    action: ctx.action,
    patientId: ctx.patientId,
    errorMessage: err.message,
    stack: err.stack,
    aiResponseSummary: extras?.aiResponseSummary,
    payloadSummary: extras?.payloadSummary,
  });
  throw err;
}

export async function callAiServiceWithRetry(
  formData: FormData,
  ctx: AiGatewayCallContext,
) {
  const url = new URL(getAiServiceUrl());
  if (shouldUseTlsEnforcement(url) && url.protocol !== "https:") {
    const err = new Error("AI servisi production ortaminda HTTPS kullanmalidir.");
    logAndThrow(ctx, err, {
      payloadSummary: JSON.stringify({ upstream: `${url.host}${url.pathname}` }),
    });
  }

  const timeoutMs = getTimeoutMs();
  const retries = getRetryCount();
  let lastError: Error | null = null;
  const upstreamSummary = JSON.stringify({
    upstream: `${url.host}${url.pathname}`,
    timeoutMs,
  });

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url.toString(), {
        method: "POST",
        body: formData,
        headers: {
          "X-AI-Gateway-Key": getAiGatewaySecret(),
          "x-request-id": ctx.requestId,
        },
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        const bodyText = await response.text();
        const transient = response.status >= 500 || response.status === 429;
        if (!transient || attempt === retries) {
          const bodySnippet = formatAiUpstreamErrorBody(
            response.status,
            bodyText,
          );
          const err = new Error(
            `AI servisi hatasi (${response.status}): ${bodySnippet}`,
          );
          logAndThrow(ctx, err, {
            aiResponseSummary: bodyText.slice(0, 200),
            payloadSummary: upstreamSummary,
          });
        }

        await delay(300 * (attempt + 1));
        continue;
      }

      try {
        return await response.json();
      } catch (parseErr) {
        const err =
          parseErr instanceof Error
            ? parseErr
            : new Error("AI yaniti JSON olarak cozumlenemedi.");
        logAndThrow(ctx, err, {
          aiResponseSummary: "json_parse_failed",
          payloadSummary: upstreamSummary,
        });
      }
    } catch (error) {
      clearTimeout(timer);
      const err =
        error instanceof Error
          ? error.name === "AbortError"
            ? new Error(
                `AI servisi ${timeoutMs}ms icinde yanit vermedi (timeout).`,
              )
            : error
          : new Error("Bilinmeyen hata");
      lastError = err;
      if (attempt === retries) break;
      await delay(300 * (attempt + 1));
    }
  }

  const finalErr = lastError || new Error("AI servisine ulasilamadi.");
  logAndThrow(ctx, finalErr, { payloadSummary: upstreamSummary });
}

export async function callAiFfaServiceWithRetry(
  formData: FormData,
  ctx: AiGatewayCallContext,
) {
  const url = new URL(getDerivedFfaServiceUrl());
  if (shouldUseTlsEnforcement(url) && url.protocol !== "https:") {
    const err = new Error("AI servisi production ortaminda HTTPS kullanmalidir.");
    logAndThrow(ctx, err, {
      payloadSummary: JSON.stringify({ upstream: `${url.host}${url.pathname}` }),
    });
  }

  const timeoutMs = getTimeoutMs();
  const retries = getRetryCount();
  let lastError: Error | null = null;
  const upstreamSummary = JSON.stringify({
    upstream: `${url.host}${url.pathname}`,
    timeoutMs,
  });

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url.toString(), {
        method: "POST",
        body: formData,
        headers: {
          "X-AI-Gateway-Key": getAiGatewaySecret(),
          "x-request-id": ctx.requestId,
        },
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        const bodyText = await response.text();
        const transient = response.status >= 500 || response.status === 429;
        if (!transient || attempt === retries) {
          const bodySnippet = formatAiUpstreamErrorBody(
            response.status,
            bodyText,
          );
          const err = new Error(
            `AI servisi hatasi (${response.status}): ${bodySnippet}`,
          );
          logAndThrow(ctx, err, {
            aiResponseSummary: bodyText.slice(0, 200),
            payloadSummary: upstreamSummary,
          });
        }

        await delay(300 * (attempt + 1));
        continue;
      }

      try {
        return await response.json();
      } catch (parseErr) {
        const err =
          parseErr instanceof Error
            ? parseErr
            : new Error("AI yaniti JSON olarak cozumlenemedi.");
        logAndThrow(ctx, err, {
          aiResponseSummary: "json_parse_failed",
          payloadSummary: upstreamSummary,
        });
      }
    } catch (error) {
      clearTimeout(timer);
      const err =
        error instanceof Error
          ? error.name === "AbortError"
            ? new Error(
                `AI servisi ${timeoutMs}ms icinde yanit vermedi (timeout).`,
              )
            : error
          : new Error("Bilinmeyen hata");
      lastError = err;
      if (attempt === retries) break;
      await delay(300 * (attempt + 1));
    }
  }

  const finalErr = lastError || new Error("AI servisine ulasilamadi.");
  logAndThrow(ctx, finalErr, { payloadSummary: upstreamSummary });
}

export async function callAiOctServiceWithRetry(
  formData: FormData,
  ctx: AiGatewayCallContext,
) {
  const url = new URL(getDerivedOctServiceUrl());
  if (shouldUseTlsEnforcement(url) && url.protocol !== "https:") {
    const err = new Error("AI servisi production ortaminda HTTPS kullanmalidir.");
    logAndThrow(ctx, err, {
      payloadSummary: JSON.stringify({ upstream: `${url.host}${url.pathname}` }),
    });
  }

  const timeoutMs = getTimeoutMs();
  const retries = getRetryCount();
  let lastError: Error | null = null;
  const upstreamSummary = JSON.stringify({
    upstream: `${url.host}${url.pathname}`,
    timeoutMs,
  });

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url.toString(), {
        method: "POST",
        body: formData,
        headers: {
          "X-AI-Gateway-Key": getAiGatewaySecret(),
          "x-request-id": ctx.requestId,
        },
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        const bodyText = await response.text();
        const transient = response.status >= 500 || response.status === 429;
        if (!transient || attempt === retries) {
          const bodySnippet = formatAiUpstreamErrorBody(
            response.status,
            bodyText,
          );
          const err = new Error(
            `AI servisi hatasi (${response.status}): ${bodySnippet}`,
          );
          logAndThrow(ctx, err, {
            aiResponseSummary: bodyText.slice(0, 200),
            payloadSummary: upstreamSummary,
          });
        }

        await delay(300 * (attempt + 1));
        continue;
      }

      try {
        return await response.json();
      } catch (parseErr) {
        const err =
          parseErr instanceof Error
            ? parseErr
            : new Error("AI yaniti JSON olarak cozumlenemedi.");
        logAndThrow(ctx, err, {
          aiResponseSummary: "json_parse_failed",
          payloadSummary: upstreamSummary,
        });
      }
    } catch (error) {
      clearTimeout(timer);
      const err =
        error instanceof Error
          ? error.name === "AbortError"
            ? new Error(
                `AI servisi ${timeoutMs}ms icinde yanit vermedi (timeout).`,
              )
            : error
          : new Error("Bilinmeyen hata");
      lastError = err;
      if (attempt === retries) break;
      await delay(300 * (attempt + 1));
    }
  }

  const finalErr = lastError || new Error("AI servisine ulasilamadi.");
  logAndThrow(ctx, finalErr, { payloadSummary: upstreamSummary });
}
