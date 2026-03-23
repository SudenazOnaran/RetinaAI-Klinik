import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { DoctorRole } from "@/lib/roles";

export type AuditAction =
  | "VIEW"
  | "EDIT"
  | "APPROVE"
  | "DOWNLOAD"
  | "CREATE"
  | "DELETE";

type AuditEntityType =
  | "PATIENT"
  | "ANALYSIS"
  | "REPORT"
  | "SETTINGS"
  | "CALENDAR"
  | "SYSTEM";

type AuditLogInput = {
  doctorId: string;
  role: DoctorRole;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: string | null;
  description?: string;
  metadata?: Record<string, unknown>;
};

let ensured = false;

async function ensureAuditLogTable() {
  if (ensured) return;

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AuditLog" (
      "id" TEXT NOT NULL,
      "doctorId" TEXT NOT NULL,
      "role" TEXT NOT NULL,
      "action" TEXT NOT NULL,
      "entityType" TEXT NOT NULL,
      "entityId" TEXT,
      "description" TEXT,
      "metadata" JSONB,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "AuditLog_doctorId_createdAt_idx"
    ON "AuditLog"("doctorId", "createdAt" DESC);
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "AuditLog_action_createdAt_idx"
    ON "AuditLog"("action", "createdAt" DESC);
  `);

  ensured = true;
}

export async function logAuditEvent(input: AuditLogInput) {
  try {
    await ensureAuditLogTable();

    const id = randomUUID();
    const metadataJson = input.metadata
      ? JSON.stringify(input.metadata)
      : JSON.stringify({});

    await prisma.$executeRaw`
      INSERT INTO "AuditLog" (
        "id",
        "doctorId",
        "role",
        "action",
        "entityType",
        "entityId",
        "description",
        "metadata",
        "createdAt"
      )
      VALUES (
        ${id},
        ${input.doctorId},
        ${input.role},
        ${input.action},
        ${input.entityType},
        ${input.entityId ?? null},
        ${input.description ?? null},
        ${metadataJson}::jsonb,
        CURRENT_TIMESTAMP
      )
    `;
  } catch (error) {
    // Audit log hatasi klinik akislarini bozmasin.
    console.error("Audit log yazilamadi:", error);
  }
}
