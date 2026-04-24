-- TrainingDatasetEntry: yalnizca DR; ODIR/LLM snapshot/ogretmen metni kaldirildi
ALTER TABLE "TrainingDatasetEntry" DROP COLUMN IF EXISTS "llmStructuredOutput";
ALTER TABLE "TrainingDatasetEntry" DROP COLUMN IF EXISTS "teacherClinicalReasoning";
ALTER TABLE "TrainingDatasetEntry" DROP COLUMN IF EXISTS "teacherUncertaintyNote";
ALTER TABLE "TrainingDatasetEntry" ADD COLUMN IF NOT EXISTS "aiConfidence" DOUBLE PRECISION;
