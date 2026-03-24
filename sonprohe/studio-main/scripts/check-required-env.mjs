#!/usr/bin/env node

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadDotenv } from "dotenv";

const envPath = resolve(process.cwd(), ".env");
const envLocalPath = resolve(process.cwd(), ".env.local");

if (existsSync(envPath)) {
  loadDotenv({ path: envPath });
}

if (existsSync(envLocalPath)) {
  loadDotenv({ path: envLocalPath, override: true });
}

const mode = (process.env.ENV_CHECK_MODE || "dev").trim().toLowerCase();

const requiredAllModes = [
  "DATABASE_URL",
  "AI_GATEWAY_SHARED_SECRET",
  "DEPLOYMENT_PROFILE",
];

const oneOfGroups = [["SESSION_SECRET", "NEXTAUTH_SECRET"]];

const requiredRelease = [
  "INTERNAL_HEALTH_TOKEN",
  "PILOT_METRICS_CRON_SECRET",
  "AI_CORS_ALLOWED_ORIGINS",
  "MONITORING_P95_LATENCY_MS",
  "MONITORING_ERROR_RATE_PERCENT",
  "MONITORING_QUEUE_DEPTH_THRESHOLD",
  "SLA_UPTIME_TARGET_PERCENT",
  "SLA_P1_RESPONSE_MINUTES",
  "SLA_P1_RESOLUTION_HOURS",
  "SLA_P2_RESPONSE_HOURS",
  "SLA_BACKUP_FREQUENCY_HOURS",
  "SLA_RPO_HOURS",
  "SLA_RTO_HOURS",
];

const missing = [];

for (const name of requiredAllModes) {
  const value = (process.env[name] || "").trim();
  if (!value) missing.push(name);
}

for (const group of oneOfGroups) {
  const hasOne = group.some(
    (name) => (process.env[name] || "").trim().length > 0,
  );
  if (!hasOne) missing.push(`${group.join(" | ")}`);
}

if (mode === "release") {
  for (const name of requiredRelease) {
    const value = (process.env[name] || "").trim();
    if (!value) missing.push(name);
  }

  const aiServiceUrl = (process.env.AI_SERVICE_URL || "").trim();
  if (!aiServiceUrl) {
    missing.push("AI_SERVICE_URL");
  }
}

if (missing.length > 0) {
  console.error("[env-check] Eksik zorunlu env degiskenleri:");
  for (const item of missing) {
    console.error(` - ${item}`);
  }
  process.exit(1);
}

console.log(`[env-check] PASS (mode=${mode})`);
