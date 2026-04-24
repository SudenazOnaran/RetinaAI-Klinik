-- TrainingDatasetEntry: yalnizca egitim icin gerekli sutunlar; diger alanlar Analysis uzerinde kalir.

ALTER TABLE "TrainingDatasetEntry" DROP CONSTRAINT IF EXISTS "TrainingDatasetEntry_doctorId_fkey";
ALTER TABLE "TrainingDatasetEntry" DROP CONSTRAINT IF EXISTS "TrainingDatasetEntry_patientId_fkey";

DROP INDEX IF EXISTS "TrainingDatasetEntry_doctorId_excludedFromTraining_createdAt_idx";

ALTER TABLE "TrainingDatasetEntry" DROP COLUMN IF EXISTS "doctorId";
ALTER TABLE "TrainingDatasetEntry" DROP COLUMN IF EXISTS "patientId";
ALTER TABLE "TrainingDatasetEntry" DROP COLUMN IF EXISTS "heatmapUrl";
ALTER TABLE "TrainingDatasetEntry" DROP COLUMN IF EXISTS "doctorStructuredReview";
ALTER TABLE "TrainingDatasetEntry" DROP COLUMN IF EXISTS "physicianClinicalReasoning";
ALTER TABLE "TrainingDatasetEntry" DROP COLUMN IF EXISTS "comorbidityJson";
ALTER TABLE "TrainingDatasetEntry" DROP COLUMN IF EXISTS "uncertaintyScore";
ALTER TABLE "TrainingDatasetEntry" DROP COLUMN IF EXISTS "datasetSchemaVersion";
ALTER TABLE "TrainingDatasetEntry" DROP COLUMN IF EXISTS "splitAssignment";
ALTER TABLE "TrainingDatasetEntry" DROP COLUMN IF EXISTS "excludedFromTraining";
ALTER TABLE "TrainingDatasetEntry" DROP COLUMN IF EXISTS "createdAt";
