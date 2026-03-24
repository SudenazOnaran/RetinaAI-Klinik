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

export async function logAuditEvent(input: AuditLogInput) {
  try {
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
