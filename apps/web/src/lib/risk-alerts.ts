import { RetinaSettings } from "@/lib/retina-settings";
import { getDrStageIndexFromLabel } from "@/lib/dr-stage-labels";
import { computeDiseaseTriageFromAnalysisFields } from "@/lib/patient-disease-triage";

/** Son kayıtta hastalık triajı `Patient.risk` içinde `__DTG__:URGENT|` ile işaretlenir. */
export function isUrgentDiseaseTriageStored(
  value: string | null | undefined,
): boolean {
  const s = String(value ?? "").trim();
  return s.startsWith("__DTG__:") && s.includes("URGENT");
}

export function isHighRiskLabel(value: string | null | undefined): boolean {
  const idx = getDrStageIndexFromLabel(value);
  return idx === 3 || idx === 4;
}

export function getFollowupDaysForRisk(
  risk: string | null | undefined,
  settings: RetinaSettings,
): number {
  if (isUrgentDiseaseTriageStored(risk)) {
    return settings.triage.highRiskFollowupDays;
  }

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

export type CriticalAlertLatestFeedback = {
  drFeedback?: string | null;
  octDrFeedback?: string | null;
  ffaDrFeedback?: string | null;
};

export function isCriticalAlertCandidate(
  risk: string | null | undefined,
  confidence: number | null | undefined,
  settings: RetinaSettings,
  latestFeedback?: CriticalAlertLatestFeedback | null,
): boolean {
  if (latestFeedback) {
    const { triage } = computeDiseaseTriageFromAnalysisFields({
      drFeedback: latestFeedback.drFeedback ?? null,
      octDrFeedback: latestFeedback.octDrFeedback ?? null,
      ffaDrFeedback: latestFeedback.ffaDrFeedback ?? null,
    });
    if (triage === "urgent") return true;
  }

  if (isUrgentDiseaseTriageStored(risk)) {
    return true;
  }
  const safeConfidence = confidence ?? 0;
  return (
    isHighRiskLabel(risk) &&
    safeConfidence >= settings.triage.aiConfidenceThreshold
  );
}
