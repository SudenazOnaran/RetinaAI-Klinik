-- Add active/passive account control for doctors
ALTER TABLE "Doctor"
ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT TRUE;
