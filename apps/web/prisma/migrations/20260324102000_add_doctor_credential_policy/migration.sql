CREATE TABLE IF NOT EXISTS "DoctorCredentialPolicy" (
  "doctorId" TEXT NOT NULL,
  "mustResetPassword" BOOLEAN NOT NULL DEFAULT TRUE,
  "temporaryPasswordExpiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DoctorCredentialPolicy_pkey" PRIMARY KEY ("doctorId"),
  CONSTRAINT "DoctorCredentialPolicy_doctorId_fkey"
    FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "DoctorCredentialPolicy_mustResetPassword_idx"
  ON "DoctorCredentialPolicy"("mustResetPassword");
