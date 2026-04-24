-- TrainingDatasetEntry: Prisma'da kalan sutunlar id, analysisId, originalImageUrl, drFeedback, inferenceSnapshotJson, updatedAt.
-- Eski DB'lerde labelAiResult (NOT NULL) vb. kalir; Prisma INSERT bu sutunlari gondermez -> null constraint hatasi.

ALTER TABLE "TrainingDatasetEntry" DROP COLUMN IF EXISTS "doctorId";
ALTER TABLE "TrainingDatasetEntry" DROP COLUMN IF EXISTS "patientId";
ALTER TABLE "TrainingDatasetEntry" DROP COLUMN IF EXISTS "heatmapUrl";
ALTER TABLE "TrainingDatasetEntry" DROP COLUMN IF EXISTS "llmStructuredOutput";
ALTER TABLE "TrainingDatasetEntry" DROP COLUMN IF EXISTS "drGradeInt";
ALTER TABLE "TrainingDatasetEntry" DROP COLUMN IF EXISTS "labelAiResult";
ALTER TABLE "TrainingDatasetEntry" DROP COLUMN IF EXISTS "datasetSchemaVersion";
ALTER TABLE "TrainingDatasetEntry" DROP COLUMN IF EXISTS "splitAssignment";
ALTER TABLE "TrainingDatasetEntry" DROP COLUMN IF EXISTS "excludedFromTraining";
ALTER TABLE "TrainingDatasetEntry" DROP COLUMN IF EXISTS "createdAt";
ALTER TABLE "TrainingDatasetEntry" DROP COLUMN IF EXISTS "teacherClinicalReasoning";
ALTER TABLE "TrainingDatasetEntry" DROP COLUMN IF EXISTS "teacherUncertaintyNote";
ALTER TABLE "TrainingDatasetEntry" DROP COLUMN IF EXISTS "goldDrGradeInt";
ALTER TABLE "TrainingDatasetEntry" DROP COLUMN IF EXISTS "labelQuality";
ALTER TABLE "TrainingDatasetEntry" DROP COLUMN IF EXISTS "doctorStructuredReview";
ALTER TABLE "TrainingDatasetEntry" DROP COLUMN IF EXISTS "physicianClinicalReasoning";
ALTER TABLE "TrainingDatasetEntry" DROP COLUMN IF EXISTS "aiConfidence";
ALTER TABLE "TrainingDatasetEntry" DROP COLUMN IF EXISTS "goldDmeSuspected";
ALTER TABLE "TrainingDatasetEntry" DROP COLUMN IF EXISTS "goldDmeConfidence";
ALTER TABLE "TrainingDatasetEntry" DROP COLUMN IF EXISTS "comorbidityJson";
ALTER TABLE "TrainingDatasetEntry" DROP COLUMN IF EXISTS "uncertaintyScore";
