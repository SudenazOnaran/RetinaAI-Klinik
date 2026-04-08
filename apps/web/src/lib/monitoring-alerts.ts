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

type HealthMetricAlerts = Array<{
  key: "p95LatencyMs" | "errorRatePercent" | "queueDepth";
  severity: AlertSeverity;
  value: number;
  threshold: number;
}>;

function toFiniteNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readMonitoringThresholds() {
  return {
    p95LatencyMs: Math.max(
      100,
      toFiniteNumber(process.env.MONITORING_P95_LATENCY_MS, 1200),
    ),
    errorRatePercent: Math.max(
      0,
      toFiniteNumber(process.env.MONITORING_ERROR_RATE_PERCENT, 5),
    ),
    queueDepth: Math.max(
      1,
      toFiniteNumber(process.env.MONITORING_QUEUE_DEPTH_THRESHOLD, 25),
    ),
  };
}

export async function createMonitoringAlert(input: {
  doctorId?: string | null;
  source: string;
  severity: AlertSeverity;
  title: string;
  detail: string;
  metadata?: Record<string, unknown>;
}) {
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
  const startedAt = Date.now();
  const thresholds = readMonitoringThresholds();

  try {
    const result = await prisma.$queryRaw<Array<{ now: Date }>>`
      SELECT NOW() as "now"
    `;

    const queueStats = await prisma.$queryRaw<Array<{ pendingCount: number }>>`
      SELECT COUNT(*)::int as "pendingCount"
      FROM "AiRequestQueue"
      WHERE "status" IN ('PENDING', 'RETRY')
    `;

    const integrationStats = await prisma.$queryRaw<
      Array<{ totalCount: number; failedCount: number }>
    >`
      SELECT
        COUNT(*)::int as "totalCount",
        COUNT(*) FILTER (WHERE "status" <> 'SUCCESS')::int as "failedCount"
      FROM "IntegrationEvent"
      WHERE "createdAt" >= NOW() - INTERVAL '1 hour'
    `;

    const latencyMs = Date.now() - startedAt;
    const totalCount = Number(integrationStats[0]?.totalCount || 0);
    const failedCount = Number(integrationStats[0]?.failedCount || 0);
    const errorRatePercent =
      totalCount > 0
        ? Number(((failedCount / totalCount) * 100).toFixed(2))
        : 0;
    const queueDepth = Number(queueStats[0]?.pendingCount || 0);

    const metricAlerts: HealthMetricAlerts = [];
    if (latencyMs >= thresholds.p95LatencyMs) {
      metricAlerts.push({
        key: "p95LatencyMs",
        severity: "WARNING",
        value: latencyMs,
        threshold: thresholds.p95LatencyMs,
      });
    }
    if (errorRatePercent >= thresholds.errorRatePercent) {
      metricAlerts.push({
        key: "errorRatePercent",
        severity: "CRITICAL",
        value: errorRatePercent,
        threshold: thresholds.errorRatePercent,
      });
    }
    if (queueDepth >= thresholds.queueDepth) {
      metricAlerts.push({
        key: "queueDepth",
        severity: "CRITICAL",
        value: queueDepth,
        threshold: thresholds.queueDepth,
      });
    }

    return {
      ok: metricAlerts.length === 0,
      db: "up" as const,
      timestamp: new Date().toISOString(),
      dbNow: result[0]?.now?.toISOString() ?? null,
      metrics: {
        p95LatencyMs: latencyMs,
        errorRatePercent,
        queueDepth,
      },
      thresholds,
      alerts: metricAlerts,
    };
  } catch (error) {
    return {
      ok: false,
      db: "down" as const,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "db check failed",
      metrics: {
        p95LatencyMs: Date.now() - startedAt,
        errorRatePercent: null,
        queueDepth: null,
      },
      thresholds,
      alerts: [
        {
          key: "p95LatencyMs" as const,
          severity: "CRITICAL" as const,
          value: Date.now() - startedAt,
          threshold: thresholds.p95LatencyMs,
        },
      ],
    };
  }
}
