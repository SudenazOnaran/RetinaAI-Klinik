ALTER TABLE "TrainingDatasetEntry" ADD COLUMN IF NOT EXISTS "teacherClinicalReasoning" TEXT;
ALTER TABLE "TrainingDatasetEntry" ADD COLUMN IF NOT EXISTS "teacherUncertaintyNote" TEXT;
