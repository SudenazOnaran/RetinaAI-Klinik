import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

export type ConsentRow = {
  patientId: string;
  consentGiven: boolean;
  consentVersion: string;
  consentAt: Date | null;
  note: string | null;
  updatedAt: Date;
};

export type ProcessingLogRow = {
  id: string;
  patientId: string | null;
  action: string;
  detail: string;
  createdAt: Date;
};

let ensured = false;

export async function ensureKvkkTables() {
  if (ensured) return;

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "KvkkConsent" (
      "id" TEXT NOT NULL,
      "doctorId" TEXT NOT NULL,
      "patientId" TEXT NOT NULL,
      "consentGiven" BOOLEAN NOT NULL DEFAULT FALSE,
      "consentVersion" TEXT NOT NULL DEFAULT 'v1',
      "consentAt" TIMESTAMP(3),
      "note" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "KvkkConsent_pkey" PRIMARY KEY ("id")
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "KvkkConsent_doctorId_patientId_key"
    ON "KvkkConsent"("doctorId", "patientId");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "KvkkConsent_doctorId_updatedAt_idx"
    ON "KvkkConsent"("doctorId", "updatedAt" DESC);
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "KvkkProcessingLog" (
      "id" TEXT NOT NULL,
      "doctorId" TEXT NOT NULL,
      "patientId" TEXT,
      "action" TEXT NOT NULL,
      "detail" TEXT NOT NULL,
      "metadata" JSONB,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "KvkkProcessingLog_pkey" PRIMARY KEY ("id")
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "KvkkProcessingLog_doctorId_createdAt_idx"
    ON "KvkkProcessingLog"("doctorId", "createdAt" DESC);
  `);

  ensured = true;
}

export async function getKvkkConsents(doctorId: string) {
  await ensureKvkkTables();

  return prisma.$queryRaw<ConsentRow[]>`
    SELECT
      "patientId",
      "consentGiven",
      "consentVersion",
      "consentAt",
      "note",
      "updatedAt"
    FROM "KvkkConsent"
    WHERE "doctorId" = ${doctorId}
    ORDER BY "updatedAt" DESC
  `;
}

export async function upsertKvkkConsent(input: {
  doctorId: string;
  patientId: string;
  consentGiven: boolean;
  consentVersion: string;
  note?: string;
}) {
  await ensureKvkkTables();

  const id = randomUUID();
  const note = input.note?.trim() || null;

  const rows = await prisma.$queryRaw<ConsentRow[]>`
    INSERT INTO "KvkkConsent" (
      "id",
      "doctorId",
      "patientId",
      "consentGiven",
      "consentVersion",
      "consentAt",
      "note",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${id},
      ${input.doctorId},
      ${input.patientId},
      ${input.consentGiven},
      ${input.consentVersion || "v1"},
      ${input.consentGiven ? new Date() : null},
      ${note},
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT ("doctorId", "patientId")
    DO UPDATE SET
      "consentGiven" = EXCLUDED."consentGiven",
      "consentVersion" = EXCLUDED."consentVersion",
      "consentAt" = EXCLUDED."consentAt",
      "note" = EXCLUDED."note",
      "updatedAt" = CURRENT_TIMESTAMP
    RETURNING
      "patientId",
      "consentGiven",
      "consentVersion",
      "consentAt",
      "note",
      "updatedAt"
  `;

  return rows[0];
}

export async function appendKvkkProcessingLog(input: {
  doctorId: string;
  patientId?: string | null;
  action: string;
  detail: string;
  metadata?: Record<string, unknown>;
}) {
  await ensureKvkkTables();
  const id = randomUUID();
  const metadataJson = JSON.stringify(input.metadata || {});

  await prisma.$executeRaw`
    INSERT INTO "KvkkProcessingLog" (
      "id",
      "doctorId",
      "patientId",
      "action",
      "detail",
      "metadata",
      "createdAt"
    )
    VALUES (
      ${id},
      ${input.doctorId},
      ${input.patientId ?? null},
      ${input.action},
      ${input.detail},
      ${metadataJson}::jsonb,
      CURRENT_TIMESTAMP
    )
  `;
}

export async function getKvkkProcessingLogs(doctorId: string, limit = 50) {
  await ensureKvkkTables();

  return prisma.$queryRaw<ProcessingLogRow[]>`
    SELECT
      "id",
      "patientId",
      "action",
      "detail",
      "createdAt"
    FROM "KvkkProcessingLog"
    WHERE "doctorId" = ${doctorId}
    ORDER BY "createdAt" DESC
    LIMIT ${Math.max(1, Math.min(limit, 200))}
  `;
}
