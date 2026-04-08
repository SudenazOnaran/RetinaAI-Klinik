-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "diabetesYears" INTEGER,
ADD COLUMN     "gender" TEXT,
ADD COLUMN     "hba1c" DOUBLE PRECISION,
ALTER COLUMN "userId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Doctor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Doctor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Analysis" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "aiResult" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "heatmapUrl" TEXT,
    "originalImage" TEXT,
    "doctorNote" TEXT,
    "isCorrect" BOOLEAN,
    "actualResult" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aiOdriLabels" TEXT,
    "aiOdriConfidences" TEXT,
    "ilaclar" VARCHAR(200),
    "drFeedback" TEXT,

    CONSTRAINT "Analysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Doctor_email_key" ON "Doctor"("email");

-- AddForeignKey
ALTER TABLE "Analysis" ADD CONSTRAINT "Analysis_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
