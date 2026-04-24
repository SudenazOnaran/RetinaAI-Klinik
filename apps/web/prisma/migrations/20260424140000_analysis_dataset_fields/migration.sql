-- Analysis: LLM/yerel cikti anlik kaydi + veri seti export
ALTER TABLE "Analysis" ADD COLUMN IF NOT EXISTS "aiInferenceJson" JSONB;
ALTER TABLE "Analysis" ADD COLUMN IF NOT EXISTS "drGradeInt" INTEGER;
ALTER TABLE "Analysis" ADD COLUMN IF NOT EXISTS "datasetSchemaVersion" TEXT NOT NULL DEFAULT '1';
