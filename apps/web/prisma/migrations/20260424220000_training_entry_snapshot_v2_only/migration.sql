-- TrainingDatasetEntry: yalnizca originalImageUrl, drFeedback, inferenceSnapshotJson

ALTER TABLE "TrainingDatasetEntry" DROP COLUMN IF EXISTS "drGradeInt";
ALTER TABLE "TrainingDatasetEntry" DROP COLUMN IF EXISTS "goldDrGradeInt";
ALTER TABLE "TrainingDatasetEntry" DROP COLUMN IF EXISTS "goldDmeSuspected";
ALTER TABLE "TrainingDatasetEntry" DROP COLUMN IF EXISTS "goldDmeConfidence";
ALTER TABLE "TrainingDatasetEntry" DROP COLUMN IF EXISTS "labelQuality";
ALTER TABLE "TrainingDatasetEntry" DROP COLUMN IF EXISTS "aiConfidence";
ALTER TABLE "TrainingDatasetEntry" DROP COLUMN IF EXISTS "labelAiResult";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'TrainingDatasetEntry' AND column_name = 'labelDrFeedback'
  ) THEN
    ALTER TABLE "TrainingDatasetEntry" RENAME COLUMN "labelDrFeedback" TO "drFeedback";
  END IF;
END $$;
