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

export async function getKvkkConsents(doctorId: string) {
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
