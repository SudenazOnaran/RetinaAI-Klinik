import { RetinaSettings } from "@/lib/retina-settings";
import { getDrStageIndexFromLabel } from "@/lib/dr-stage-labels";

export function isHighRiskLabel(value: string | null | undefined): boolean {
  const idx = getDrStageIndexFromLabel(value);
  return idx === 3 || idx === 4;
}

export function getFollowupDaysForRisk(
  risk: string | null | undefined,
  settings: RetinaSettings,
): number {
  const idx = getDrStageIndexFromLabel(risk);

  if (idx === 3 || idx === 4) {
    return settings.triage.highRiskFollowupDays;
  }

  if (idx === 2) {
    return settings.triage.mediumRiskFollowupDays;
  }

  return settings.triage.lowRiskFollowupDays;
}

export function computePlannedFollowupDate(
  latestAnalysisAt: string | Date | null | undefined,
  risk: string | null | undefined,
  settings: RetinaSettings,
): Date | null {
  if (!latestAnalysisAt) return null;

  const baseDate = new Date(latestAnalysisAt);
  if (Number.isNaN(baseDate.getTime())) return null;

  const followupDays = getFollowupDaysForRisk(risk, settings);
  const plannedUtcMs = Date.UTC(
    baseDate.getUTCFullYear(),
    baseDate.getUTCMonth(),
    baseDate.getUTCDate() + followupDays,
  );

  return new Date(plannedUtcMs);
}

export function daysUntil(date: Date): number {
  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;

  const startOfTodayUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const startOfTargetUtc = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  );

  return Math.floor((startOfTargetUtc - startOfTodayUtc) / dayMs);
}

export function isCriticalAlertCandidate(
  risk: string | null | undefined,
  confidence: number | null | undefined,
  settings: RetinaSettings,
): boolean {
  const safeConfidence = confidence ?? 0;
  return (
    isHighRiskLabel(risk) &&
    safeConfidence >= settings.triage.aiConfidenceThreshold
  );
}
