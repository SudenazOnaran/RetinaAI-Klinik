import { getDrStageIndexFromLabel } from "@/lib/dr-stage-labels";

export type TrainingLabelQuality = "weak" | "verified" | "synthetic";

/** Doktor geri bildirimi > AI snapshot drGrade > kayıtlı AI evre metni */
export function resolveGoldDrGradeInt(params: {
  feedbackStored?: string | null;
  inferenceDrGrade?: number | null;
  aiResultStored: string;
}): number | null {
  const fromFb = params.feedbackStored
    ? getDrStageIndexFromLabel(params.feedbackStored)
    : null;
  if (fromFb !== null) return fromFb;
  const inf = params.inferenceDrGrade;
  if (inf != null && inf >= 0 && inf <= 4) return inf;
  return getDrStageIndexFromLabel(params.aiResultStored);
}

export function computeTrainingLabelQuality(params: {
  hasDrFeedback: boolean;
  physicianReasoning?: string | null;
  doctorStructuredReview?: Record<string, unknown> | null;
}): TrainingLabelQuality {
  if (params.hasDrFeedback) return "verified";
  if (params.physicianReasoning?.trim()) return "verified";
  const rev = params.doctorStructuredReview;
  if (rev && Object.keys(rev).length > 0) return "verified";
  return "weak";
}
