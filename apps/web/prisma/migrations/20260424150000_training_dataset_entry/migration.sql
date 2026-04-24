-- Yerel ML egitim veri seti satirlari (Analysis ile 1:1)
CREATE TABLE "TrainingDatasetEntry" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "originalImageUrl" TEXT NOT NULL,
    "heatmapUrl" TEXT,
    "llmStructuredOutput" JSONB,
    "drGradeInt" INTEGER,
    "labelAiResult" TEXT NOT NULL,
    "labelDrFeedback" TEXT,
    "datasetSchemaVersion" TEXT NOT NULL DEFAULT '1',
    "splitAssignment" TEXT NOT NULL DEFAULT 'unassigned',
    "excludedFromTraining" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingDatasetEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TrainingDatasetEntry_analysisId_key" ON "TrainingDatasetEntry"("analysisId");

CREATE INDEX "TrainingDatasetEntry_doctorId_excludedFromTraining_createdAt_idx" ON "TrainingDatasetEntry"("doctorId", "excludedFromTraining", "createdAt" DESC);

ALTER TABLE "TrainingDatasetEntry" ADD CONSTRAINT "TrainingDatasetEntry_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TrainingDatasetEntry" ADD CONSTRAINT "TrainingDatasetEntry_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TrainingDatasetEntry" ADD CONSTRAINT "TrainingDatasetEntry_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
