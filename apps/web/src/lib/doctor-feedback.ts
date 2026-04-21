import { normalizeRiskKey } from "@/lib/dr-stage-labels";

/**
 * drFeedback alanında risk etiketi değil, "AI ile aynı fikirdeyim" anlamındaki değerler.
 * Bunlar risk olarak gösterilmez; sıradaki kaynak (aiResult) kullanılır.
 */
const DOCTOR_APPROVAL_KEYS = new Set([
  "ai_sonucu_dogru",
  "ai_dogru",
  "dogru",
  "evet",
  "yes",
  "correct",
]);

export function isDoctorApprovalToken(value: string | null | undefined): boolean {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return false;
  return DOCTOR_APPROVAL_KEYS.has(normalizeRiskKey(trimmed));
}
