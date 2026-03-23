import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

export type PilotMetricKey =
  | "TIME_PER_PATIENT_MIN"
  | "ERROR_RATE_PERCENT"
  | "CLINIC_VISIT_DURATION_MIN";

export type PilotMetricDirection = "LOWER_IS_BETTER" | "HIGHER_IS_BETTER";

export type PilotMetricRow = {
  id: string;
  doctorId: string;
  metricKey: PilotMetricKey;
  metricLabel: string;
  direction: PilotMetricDirection;
  baselineValue: number;
  currentValue: number;
  unit: string;
  sampleSize: number;
  periodStart: Date;
  periodEnd: Date;
  note: string | null;
  createdAt: Date;
};

export type PilotMetricSummaryRow = {
  metricKey: PilotMetricKey;
  metricLabel: string;
  direction: PilotMetricDirection;
  baselineValue: number;
  currentValue: number;
  unit: string;
  sampleSize: number;
  periodStart: Date;
  periodEnd: Date;
  improvementPercent: number | null;
};

export type PilotMetricSnapshotRow = {
  id: string;
  doctorId: string;
  snapshotMonth: string;
  summary: PilotMetricSummaryRow[];
  eventCount: number;
  generatedAt: Date;
};

let ensured = false;

export function computePilotImprovementPercent(input: {
  baselineValue: number;
  currentValue: number;
  direction: PilotMetricDirection;
}): number | null {
  const baseline = Number(input.baselineValue);
  const current = Number(input.currentValue);

  if (
    !Number.isFinite(baseline) ||
    baseline === 0 ||
    !Number.isFinite(current)
  ) {
    return null;
  }

  if (input.direction === "LOWER_IS_BETTER") {
    return ((baseline - current) / baseline) * 100;
  }

  return ((current - baseline) / baseline) * 100;
}

export async function ensurePilotMetricTable() {
  if (ensured) return;

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PilotMetricEvent" (
      "id" TEXT NOT NULL,
      "doctorId" TEXT NOT NULL,
      "metricKey" TEXT NOT NULL,
      "metricLabel" TEXT NOT NULL,
      "direction" TEXT NOT NULL,
      "baselineValue" DOUBLE PRECISION NOT NULL,
      "currentValue" DOUBLE PRECISION NOT NULL,
      "unit" TEXT NOT NULL,
      "sampleSize" INTEGER NOT NULL DEFAULT 0,
      "periodStart" TIMESTAMP(3) NOT NULL,
      "periodEnd" TIMESTAMP(3) NOT NULL,
      "note" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "PilotMetricEvent_pkey" PRIMARY KEY ("id")
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "PilotMetricEvent_doctorId_metricKey_createdAt_idx"
    ON "PilotMetricEvent"("doctorId", "metricKey", "createdAt" DESC);
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PilotMetricSnapshot" (
      "id" TEXT NOT NULL,
      "doctorId" TEXT NOT NULL,
      "snapshotMonth" TEXT NOT NULL,
      "summaryJson" JSONB NOT NULL,
      "eventCount" INTEGER NOT NULL DEFAULT 0,
      "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "PilotMetricSnapshot_pkey" PRIMARY KEY ("id")
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "PilotMetricSnapshot_doctorId_snapshotMonth_key"
    ON "PilotMetricSnapshot"("doctorId", "snapshotMonth");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "PilotMetricSnapshot_doctorId_generatedAt_idx"
    ON "PilotMetricSnapshot"("doctorId", "generatedAt" DESC);
  `);

  ensured = true;
}

export async function createPilotMetricEvent(input: {
  doctorId: string;
  metricKey: PilotMetricKey;
  metricLabel: string;
  direction: PilotMetricDirection;
  baselineValue: number;
  currentValue: number;
  unit: string;
  sampleSize: number;
  periodStart: Date;
  periodEnd: Date;
  note?: string;
}) {
  await ensurePilotMetricTable();

  const id = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO "PilotMetricEvent" (
      "id",
      "doctorId",
      "metricKey",
      "metricLabel",
      "direction",
      "baselineValue",
      "currentValue",
      "unit",
      "sampleSize",
      "periodStart",
      "periodEnd",
      "note",
      "createdAt"
    ) VALUES (
      ${id},
      ${input.doctorId},
      ${input.metricKey},
      ${input.metricLabel},
      ${input.direction},
      ${input.baselineValue},
      ${input.currentValue},
      ${input.unit},
      ${Math.max(0, Math.floor(input.sampleSize || 0))},
      ${input.periodStart},
      ${input.periodEnd},
      ${input.note?.trim() || null},
      CURRENT_TIMESTAMP
    )
  `;
}

export async function getPilotMetricEvents(doctorId: string, limit = 100) {
  await ensurePilotMetricTable();

  return prisma.$queryRaw<PilotMetricRow[]>`
    SELECT
      "id",
      "doctorId",
      "metricKey",
      "metricLabel",
      "direction",
      "baselineValue",
      "currentValue",
      "unit",
      "sampleSize",
      "periodStart",
      "periodEnd",
      "note",
      "createdAt"
    FROM "PilotMetricEvent"
    WHERE "doctorId" = ${doctorId}
    ORDER BY "createdAt" DESC
    LIMIT ${Math.max(1, Math.min(limit, 300))}
  `;
}

export function normalizeSnapshotMonth(value?: string | null): string {
  const trimmed = String(value || "").trim();
  if (/^\d{4}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function buildPilotMetricSummary(
  events: PilotMetricRow[],
): PilotMetricSummaryRow[] {
  const latestByMetric = new Map<PilotMetricKey, PilotMetricRow>();

  for (const row of events) {
    if (!latestByMetric.has(row.metricKey)) {
      latestByMetric.set(row.metricKey, row);
    }
  }

  return Array.from(latestByMetric.values()).map((row) => ({
    metricKey: row.metricKey,
    metricLabel: row.metricLabel,
    direction: row.direction,
    baselineValue: row.baselineValue,
    currentValue: row.currentValue,
    unit: row.unit,
    sampleSize: row.sampleSize,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    improvementPercent: computePilotImprovementPercent({
      baselineValue: row.baselineValue,
      currentValue: row.currentValue,
      direction: row.direction,
    }),
  }));
}

export async function createPilotMetricSnapshot(input: {
  doctorId: string;
  snapshotMonth?: string;
}) {
  await ensurePilotMetricTable();

  const snapshotMonth = normalizeSnapshotMonth(input.snapshotMonth);
  const events = await getPilotMetricEvents(input.doctorId, 300);
  if (events.length === 0) {
    return null;
  }

  const summary = buildPilotMetricSummary(events);
  const id = randomUUID();

  await prisma.$executeRaw`
    INSERT INTO "PilotMetricSnapshot" (
      "id",
      "doctorId",
      "snapshotMonth",
      "summaryJson",
      "eventCount",
      "generatedAt"
    ) VALUES (
      ${id},
      ${input.doctorId},
      ${snapshotMonth},
      CAST(${JSON.stringify(summary)} AS jsonb),
      ${events.length},
      CURRENT_TIMESTAMP
    )
    ON CONFLICT ("doctorId", "snapshotMonth")
    DO UPDATE SET
      "summaryJson" = EXCLUDED."summaryJson",
      "eventCount" = EXCLUDED."eventCount",
      "generatedAt" = CURRENT_TIMESTAMP
  `;

  return {
    snapshotMonth,
    eventCount: events.length,
    summary,
  };
}

export async function getPilotMetricSnapshots(doctorId: string, limit = 12) {
  await ensurePilotMetricTable();

  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      doctorId: string;
      snapshotMonth: string;
      summaryJson: unknown;
      eventCount: number;
      generatedAt: Date;
    }>
  >`
    SELECT
      "id",
      "doctorId",
      "snapshotMonth",
      "summaryJson",
      "eventCount",
      "generatedAt"
    FROM "PilotMetricSnapshot"
    WHERE "doctorId" = ${doctorId}
    ORDER BY "generatedAt" DESC
    LIMIT ${Math.max(1, Math.min(limit, 36))}
  `;

  return rows.map<PilotMetricSnapshotRow>((row) => ({
    id: row.id,
    doctorId: row.doctorId,
    snapshotMonth: row.snapshotMonth,
    summary: Array.isArray(row.summaryJson)
      ? (row.summaryJson as PilotMetricSummaryRow[])
      : [],
    eventCount: row.eventCount,
    generatedAt: row.generatedAt,
  }));
}

export async function createMonthlyPilotSnapshotsForAllDoctors(
  snapshotMonth?: string,
) {
  await ensurePilotMetricTable();

  const month = normalizeSnapshotMonth(snapshotMonth);
  const doctors = await prisma.$queryRaw<Array<{ doctorId: string }>>`
    SELECT DISTINCT "doctorId"
    FROM "PilotMetricEvent"
  `;

  let processedDoctors = 0;
  let createdOrUpdated = 0;

  for (const doctor of doctors) {
    processedDoctors += 1;
    const result = await createPilotMetricSnapshot({
      doctorId: doctor.doctorId,
      snapshotMonth: month,
    });

    if (result) {
      createdOrUpdated += 1;
    }
  }

  return {
    snapshotMonth: month,
    processedDoctors,
    createdOrUpdated,
  };
}
