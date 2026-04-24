-- Analysis: doktor yapilandirilmis inceleme + istege bagli klinik metin (egitim altin / duzeltme)
ALTER TABLE "Analysis" ADD COLUMN IF NOT EXISTS "doctorStructuredReview" JSONB;
ALTER TABLE "Analysis" ADD COLUMN IF NOT EXISTS "physicianClinicalReasoning" TEXT;

-- TrainingDatasetEntry: cozulmus altin evre + etiket kalitesi (weak | verified | synthetic)
ALTER TABLE "TrainingDatasetEntry" ADD COLUMN IF NOT EXISTS "goldDrGradeInt" INTEGER;
ALTER TABLE "TrainingDatasetEntry" ADD COLUMN IF NOT EXISTS "labelQuality" TEXT NOT NULL DEFAULT 'weak';
