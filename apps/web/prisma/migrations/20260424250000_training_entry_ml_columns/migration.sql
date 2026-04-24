-- Egitim hedefleri: doktor notu parse DR + lezyon / DME sayisal sutunlar (glokom/AMD etiket degil).

ALTER TABLE "TrainingDatasetEntry" ADD COLUMN IF NOT EXISTS "doctorNotesDerivedDrGradeInt" INTEGER;
ALTER TABLE "TrainingDatasetEntry" ADD COLUMN IF NOT EXISTS "microaneurysmCountLevel" INTEGER;
ALTER TABLE "TrainingDatasetEntry" ADD COLUMN IF NOT EXISTS "hemorrhageQuadrants" INTEGER;
ALTER TABLE "TrainingDatasetEntry" ADD COLUMN IF NOT EXISTS "hardExudateMacula" INTEGER;
ALTER TABLE "TrainingDatasetEntry" ADD COLUMN IF NOT EXISTS "cottonWoolSpots" INTEGER;
ALTER TABLE "TrainingDatasetEntry" ADD COLUMN IF NOT EXISTS "venousBeading" INTEGER;
ALTER TABLE "TrainingDatasetEntry" ADD COLUMN IF NOT EXISTS "irma" INTEGER;
ALTER TABLE "TrainingDatasetEntry" ADD COLUMN IF NOT EXISTS "neovascularization" INTEGER;
ALTER TABLE "TrainingDatasetEntry" ADD COLUMN IF NOT EXISTS "trainingDmeSuspected" INTEGER;
