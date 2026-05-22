-- CreateTable
CREATE TABLE "AnteriorSegmentReport" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "patientId" TEXT,
    "imageUrl" TEXT NOT NULL,
    "aiSummary" VARCHAR(2000),
    "aiTextSummary" TEXT,
    "aiInferenceJson" JSONB NOT NULL,
    "anteriorSegmentDrFeedback" VARCHAR(4000),
    "analysisNotes" VARCHAR(2000),
    "urgentReferralNeeded" BOOLEAN NOT NULL DEFAULT false,
    "fileName" VARCHAR(260),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnteriorSegmentReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnteriorSegmentReport_doctorId_createdAt_idx" ON "AnteriorSegmentReport"("doctorId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "AnteriorSegmentReport" ADD CONSTRAINT "AnteriorSegmentReport_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnteriorSegmentReport" ADD CONSTRAINT "AnteriorSegmentReport_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
