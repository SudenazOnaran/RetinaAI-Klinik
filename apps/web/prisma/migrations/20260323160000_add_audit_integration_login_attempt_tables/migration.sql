-- CreateTable
CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "IntegrationEvent" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "httpStatus" INTEGER,
    "errorMessage" TEXT,
    "requestPayload" JSONB,
    "responsePayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "LoginAttempt" (
    "key" TEXT NOT NULL,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "windowStartedAt" TIMESTAMP(3) NOT NULL,
    "lockedUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AiRequestQueue" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiRequestQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "KvkkConsent" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "consentGiven" BOOLEAN NOT NULL DEFAULT FALSE,
    "consentVersion" TEXT NOT NULL DEFAULT 'v1',
    "consentAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KvkkConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "KvkkProcessingLog" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "patientId" TEXT,
    "action" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KvkkProcessingLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MonitoringAlert" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT,
    "source" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonitoringAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PilotMetricEvent" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "metricKey" TEXT NOT NULL,
    "metricLabel" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "baselineValue" DOUBLE PRECISION NOT NULL,
    "currentValue" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "sampleSize" INTEGER NOT NULL DEFAULT 0,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PilotMetricEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PilotMetricSnapshot" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "snapshotMonth" TEXT NOT NULL,
    "summaryJson" JSONB NOT NULL,
    "eventCount" INTEGER NOT NULL DEFAULT 0,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PilotMetricSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuditLog_doctorId_createdAt_idx" ON "AuditLog"("doctorId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "IntegrationEvent_doctorId_createdAt_idx" ON "IntegrationEvent"("doctorId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "IntegrationEvent_patientId_idx" ON "IntegrationEvent"("patientId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LoginAttempt_lockedUntil_idx" ON "LoginAttempt"("lockedUntil");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AiRequestQueue_status_createdAt_idx" ON "AiRequestQueue"("status", "createdAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "KvkkConsent_doctorId_patientId_key" ON "KvkkConsent"("doctorId", "patientId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "KvkkConsent_doctorId_updatedAt_idx" ON "KvkkConsent"("doctorId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "KvkkProcessingLog_doctorId_createdAt_idx" ON "KvkkProcessingLog"("doctorId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MonitoringAlert_createdAt_idx" ON "MonitoringAlert"("createdAt" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MonitoringAlert_doctorId_createdAt_idx" ON "MonitoringAlert"("doctorId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PilotMetricEvent_doctorId_metricKey_createdAt_idx" ON "PilotMetricEvent"("doctorId", "metricKey", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PilotMetricSnapshot_doctorId_snapshotMonth_key" ON "PilotMetricSnapshot"("doctorId", "snapshotMonth");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PilotMetricSnapshot_doctorId_generatedAt_idx" ON "PilotMetricSnapshot"("doctorId", "generatedAt" DESC);
