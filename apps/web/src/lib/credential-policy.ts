import { prisma } from "@/lib/prisma";

export type DoctorCredentialPolicy = {
  mustResetPassword: boolean;
  temporaryPasswordExpiresAt: Date | null;
};

export function getTemporaryPasswordTtlHours() {
  const raw = Number(process.env.TEMP_PASSWORD_TTL_HOURS || "24");
  if (!Number.isFinite(raw)) return 24;
  return Math.max(1, Math.floor(raw));
}

export function buildTemporaryPasswordExpiryDate() {
  const ttlHours = getTemporaryPasswordTtlHours();
  return new Date(Date.now() + ttlHours * 60 * 60 * 1000);
}

export async function upsertDoctorCredentialPolicy(
  doctorId: string,
  input: DoctorCredentialPolicy,
) {
  await prisma.$executeRaw`
    INSERT INTO "DoctorCredentialPolicy" (
      "doctorId",
      "mustResetPassword",
      "temporaryPasswordExpiresAt",
      "updatedAt"
    )
    VALUES (
      ${doctorId},
      ${input.mustResetPassword},
      ${input.temporaryPasswordExpiresAt},
      CURRENT_TIMESTAMP
    )
    ON CONFLICT ("doctorId")
    DO UPDATE SET
      "mustResetPassword" = EXCLUDED."mustResetPassword",
      "temporaryPasswordExpiresAt" = EXCLUDED."temporaryPasswordExpiresAt",
      "updatedAt" = CURRENT_TIMESTAMP
  `;
}

export async function getDoctorCredentialPolicy(doctorId: string) {
  const rows = await prisma.$queryRaw<
    Array<{
      mustResetPassword: boolean;
      temporaryPasswordExpiresAt: Date | null;
    }>
  >`
    SELECT
      "mustResetPassword" as "mustResetPassword",
      "temporaryPasswordExpiresAt" as "temporaryPasswordExpiresAt"
    FROM "DoctorCredentialPolicy"
    WHERE "doctorId" = ${doctorId}
    LIMIT 1
  `;

  if (rows.length === 0) return null;
  return rows[0];
}
