import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

type QueuePayload = {
  patientId?: string | null;
  fileName: string;
  mimeType: string;
  imageBase64: string;
  queuedByDoctorId: string;
};

let ensured = false;

export async function ensureAiQueueTable() {
  if (ensured) return;

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AiRequestQueue" (
      "id" TEXT NOT NULL,
      "doctorId" TEXT NOT NULL,
      "status" TEXT NOT NULL,
      "endpoint" TEXT NOT NULL,
      "payload" JSONB NOT NULL,
      "error" TEXT,
      "attempts" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "AiRequestQueue_pkey" PRIMARY KEY ("id")
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "AiRequestQueue_status_createdAt_idx"
    ON "AiRequestQueue"("status", "createdAt" ASC);
  `);

  ensured = true;
}

export async function enqueueAiRequest(input: {
  doctorId: string;
  endpoint: string;
  payload: QueuePayload;
  error?: string;
}) {
  await ensureAiQueueTable();

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

function getAiGatewaySecret() {
  return process.env.AI_GATEWAY_SHARED_SECRET || "retina-ai-gateway-dev-secret";
}

function getTimeoutMs() {
  const value = Number(process.env.AI_REQUEST_TIMEOUT_MS || "20000");
  if (!Number.isFinite(value) || value < 1000) return 20000;
  return value;
}

function getRetryCount() {
  const value = Number(process.env.AI_REQUEST_RETRY_COUNT || "2");
  if (!Number.isFinite(value) || value < 0) return 2;
  return Math.min(5, value);
}

function shouldUseTlsEnforcement(url: URL) {
  if (process.env.NODE_ENV !== "production") return false;
  if (process.env.AI_ALLOW_HTTP_IN_PROD === "1") return false;
  return true;
}

async function delay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function callAiServiceWithRetry(formData: FormData) {
  const url = new URL(getAiServiceUrl());
  if (shouldUseTlsEnforcement(url) && url.protocol !== "https:") {
    throw new Error("AI servisi production ortaminda HTTPS kullanmalidir.");
  }

  const timeoutMs = getTimeoutMs();
  const retries = getRetryCount();
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url.toString(), {
        method: "POST",
        body: formData,
        headers: {
          "X-AI-Gateway-Key": getAiGatewaySecret(),
        },
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        const bodyText = await response.text();
        const transient = response.status >= 500 || response.status === 429;
        if (!transient || attempt === retries) {
          throw new Error(
            `AI servisi hatasi (${response.status}): ${bodyText}`,
          );
        }

        await delay(300 * (attempt + 1));
        continue;
      }

      return response.json();
    } catch (error) {
      clearTimeout(timer);
      const err = error instanceof Error ? error : new Error("Bilinmeyen hata");
      lastError = err;
      if (attempt === retries) break;
      await delay(300 * (attempt + 1));
    }
  }

  throw lastError || new Error("AI servisine ulasilamadi.");
}
