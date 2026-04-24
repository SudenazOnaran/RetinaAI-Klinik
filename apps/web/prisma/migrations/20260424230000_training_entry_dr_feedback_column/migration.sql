-- TrainingDatasetEntry: Prisma alani "drFeedback". 20260424220000 calismamis DB'lerde sutun adi "labelDrFeedback" kalmis olabilir.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'TrainingDatasetEntry' AND column_name = 'labelDrFeedback'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'TrainingDatasetEntry' AND column_name = 'drFeedback'
  ) THEN
    ALTER TABLE "TrainingDatasetEntry" RENAME COLUMN "labelDrFeedback" TO "drFeedback";
  END IF;
END $$;

ALTER TABLE "TrainingDatasetEntry" ADD COLUMN IF NOT EXISTS "drFeedback" TEXT;
