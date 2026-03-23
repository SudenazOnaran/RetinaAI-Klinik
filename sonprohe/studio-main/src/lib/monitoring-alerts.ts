import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

export type AlertSeverity = "INFO" | "WARNING" | "CRITICAL";

type MonitoringAlertRow = {
  id: string;
  source: string;
  severity: AlertSeverity;
  title: string;
  detail: string;
  metadata: unknown;
  createdAt: Date;
};

let ensured = false;

export async function ensureMonitoringAlertTable() {
  if (ensured) return;

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "MonitoringAlert" (
      "id" TEXT NOT NULL,
      "doctorId" TEXT,
      "source" TEXT NOT NULL,
      "severity" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "detail" TEXT NOT NULL,
      "metadata" JSONB,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "MonitoringAlert_pkey" PRIMARY KEY ("id")
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "MonitoringAlert_createdAt_idx"
    ON "MonitoringAlert"("createdAt" DESC);
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "MonitoringAlert_doctorId_createdAt_idx"
    ON "MonitoringAlert"("doctorId", "createdAt" DESC);
  `);

  ensured = true;
}

export async function createMonitoringAlert(input: {
  doctorId?: string | null;
  source: string;
  severity: AlertSeverity;
  title: string;
  detail: string;
  metadata?: Record<string, unknown>;
}) {
  await ensureMonitoringAlertTable();

  await prisma.$executeRaw`
    INSERT INTO "MonitoringAlert" (
      "id",
      "doctorId",
      "source",
      "severity",
      "title",
      "detail",
      "metadata",
      "createdAt"
    )
    VALUES (
      ${randomUUID()},
      ${input.doctorId ?? null},
      ${input.source},
      ${input.severity},
      ${input.title},
      ${input.detail},
      ${JSON.stringify(input.metadata || {})}::jsonb,
      CURRENT_TIMESTAMP
    )
  `;
}

export async function getMonitoringAlerts(input?: {
  doctorId?: string;
  limit?: number;
}) {
  await ensureMonitoringAlertTable();

  const limit = Math.max(1, Math.min(200, input?.limit ?? 50));

  const rows = input?.doctorId
    ? await prisma.$queryRaw<MonitoringAlertRow[]>`
      SELECT "id", "source", "severity", "title", "detail", "metadata", "createdAt"
      FROM "MonitoringAlert"
      WHERE "doctorId" = ${input.doctorId}
      ORDER BY "createdAt" DESC
      LIMIT ${limit}
    `
    : await prisma.$queryRaw<MonitoringAlertRow[]>`
      SELECT "id", "source", "severity", "title", "detail", "metadata", "createdAt"
      FROM "MonitoringAlert"
      ORDER BY "createdAt" DESC
      LIMIT ${limit}
    `;

  return rows;
}

export async function checkSystemHealth() {
  try {
    const result = await prisma.$queryRaw<Array<{ now: Date }>>`
      SELECT NOW() as "now"
    `;

    return {
      ok: true,
      db: "up" as const,
      timestamp: new Date().toISOString(),
      dbNow: result[0]?.now?.toISOString() ?? null,
    };
  } catch (error) {
    return {
      ok: false,
      db: "down" as const,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "db check failed",
    };
  }
}
