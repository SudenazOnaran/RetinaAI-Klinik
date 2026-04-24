-- Egitim satiri: Analysis ile ayni anda doldurulur; export tek tablodan (joinsiz).
ALTER TABLE "TrainingDatasetEntry" ADD COLUMN IF NOT EXISTS "inferenceSnapshotJson" JSONB;
ALTER TABLE "TrainingDatasetEntry" ADD COLUMN IF NOT EXISTS "doctorStructuredReview" JSONB;
ALTER TABLE "TrainingDatasetEntry" ADD COLUMN IF NOT EXISTS "physicianClinicalReasoning" TEXT;
