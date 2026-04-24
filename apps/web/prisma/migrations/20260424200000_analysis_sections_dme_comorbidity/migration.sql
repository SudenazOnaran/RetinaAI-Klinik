-- Rapor bolumleri (ayri sutunlar), komorbidite, belirsizlik; DME altin etiketi egitim satirinda
ALTER TABLE "Analysis" ADD COLUMN IF NOT EXISTS "reportTitle" VARCHAR(500);
ALTER TABLE "Analysis" ADD COLUMN IF NOT EXISTS "reportDateKey" VARCHAR(32);
ALTER TABLE "Analysis" ADD COLUMN IF NOT EXISTS "reportDoctorDisplayName" VARCHAR(200);
ALTER TABLE "Analysis" ADD COLUMN IF NOT EXISTS "sectionAnamnesis" TEXT;
ALTER TABLE "Analysis" ADD COLUMN IF NOT EXISTS "sectionExamFindings" TEXT;
ALTER TABLE "Analysis" ADD COLUMN IF NOT EXISTS "sectionLabResults" TEXT;
ALTER TABLE "Analysis" ADD COLUMN IF NOT EXISTS "sectionClinicalAssessment" TEXT;
ALTER TABLE "Analysis" ADD COLUMN IF NOT EXISTS "sectionTreatmentRecommendations" TEXT;
ALTER TABLE "Analysis" ADD COLUMN IF NOT EXISTS "sectionDoctorNotes" TEXT;
ALTER TABLE "Analysis" ADD COLUMN IF NOT EXISTS "comorbidityJson" JSONB;
ALTER TABLE "Analysis" ADD COLUMN IF NOT EXISTS "uncertaintyScore" DOUBLE PRECISION;

ALTER TABLE "TrainingDatasetEntry" ADD COLUMN IF NOT EXISTS "goldDmeSuspected" BOOLEAN;
ALTER TABLE "TrainingDatasetEntry" ADD COLUMN IF NOT EXISTS "goldDmeConfidence" DOUBLE PRECISION;
ALTER TABLE "TrainingDatasetEntry" ADD COLUMN IF NOT EXISTS "comorbidityJson" JSONB;
ALTER TABLE "TrainingDatasetEntry" ADD COLUMN IF NOT EXISTS "uncertaintyScore" DOUBLE PRECISION;
