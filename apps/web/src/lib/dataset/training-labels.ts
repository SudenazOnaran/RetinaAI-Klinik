import { getDrStageIndexFromLabel } from "@/lib/dr-stage-labels";

export type TrainingLabelQuality = "weak" | "verified" | "synthetic";

/** Eğitim altın etiketi: sadece doktor geri bildirimi. */
export function resolveGoldDrGradeIntFromDoctorFeedback(
  feedbackStored?: string | null,
): number | null {
  return feedbackStored ? getDrStageIndexFromLabel(feedbackStored) : null;
}

export function computeTrainingLabelQuality(params: {
  hasDrFeedback: boolean;
  physicianReasoning?: string | null;
  doctorStructuredReview?: Record<string, unknown> | null;
}): TrainingLabelQuality {
  if (params.hasDrFeedback) return "verified";
  return "weak";
}
