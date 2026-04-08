-- Add missing columns to Doctor table
ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "surname" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "specialty" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "hospital" TEXT NOT NULL DEFAULT '';

-- AlterEnum: DoctorRole → add ADMIN
ALTER TYPE "DoctorRole" ADD VALUE IF NOT EXISTS 'ADMIN';

-- CreateEnum: ApprovalStatus
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ApprovalStatus') THEN
    CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
  END IF;
END $$;

-- AlterTable: Doctor → add approvalStatus column
ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'APPROVED';

-- Add doctorId to Patient if not exists (rename from userId)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Patient' AND column_name = 'userId'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Patient' AND column_name = 'doctorId'
  ) THEN
    ALTER TABLE "Patient" RENAME COLUMN "userId" TO "doctorId";
  END IF;
END $$;

-- Add foreign key from Patient to Doctor if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Patient_doctorId_fkey'
  ) THEN
    ALTER TABLE "Patient" ADD CONSTRAINT "Patient_doctorId_fkey"
      FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
