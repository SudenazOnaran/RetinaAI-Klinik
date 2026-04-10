-- CreateTable
CREATE TABLE "LandingContactRequest" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LandingContactRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LandingContactRequest_createdAt_idx" ON "LandingContactRequest"("createdAt" DESC);
