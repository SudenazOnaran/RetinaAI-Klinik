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

/** AI ile uyum kaydı: ham token yerine `mai:<görünen etiket>` saklanır (geri bildirim metni). */
export const MODALITY_AI_ALIGNED_PREFIX = "mai:";
export const OCT_MULTI_PREFIX = "oct_multi:";

export function encodeModalityAiAlignedLabel(label: string): string {
  const s = String(label ?? "").trim();
  if (!s) return "ai_sonucu_dogru";
  return `${MODALITY_AI_ALIGNED_PREFIX}${s}`;
}

export function decodeModalityAiAlignedLabel(
  raw: string | null | undefined,
): string | null {
  const t = String(raw ?? "").trim();
  if (!t.startsWith(MODALITY_AI_ALIGNED_PREFIX)) return null;
  const rest = t.slice(MODALITY_AI_ALIGNED_PREFIX.length).trim();
  return rest || null;
}

export function isModalityAiAlignedFeedback(
  raw: string | null | undefined,
): boolean {
  return String(raw ?? "").trim().startsWith(MODALITY_AI_ALIGNED_PREFIX);
}

export function isDoctorApprovalToken(value: string | null | undefined): boolean {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return false;
  if (isModalityAiAlignedFeedback(trimmed)) return true;
  return DOCTOR_APPROVAL_KEYS.has(normalizeRiskKey(trimmed));
}

/**
 * «Hayır» veya (FFA’da) DR evresi seçilmeden önce — üst state boş iken
 * onChange("") ile eşzamanlı halkayı kırmamak için. Kayıtta saklanmaz.
 */
export const MODALITY_DISAGREE_PENDING = "__m_df_pending__";

export function isModalityDisagreePending(
  value: string | null | undefined,
): boolean {
  return String(value ?? "").trim() === MODALITY_DISAGREE_PENDING;
}

/** Rapor kaydına gidecek OCT/FFA geri bildirimi; bekleyen «Hayır» token’ını eler. */
export function modalityDrFeedbackForStorage(
  value: string | null | undefined,
): string | undefined {
  const t = String(value ?? "").trim();
  if (!t || isModalityDisagreePending(t)) return undefined;
  return t;
}

export function encodeOctMultiSelection(values: string[]): string {
  const uniq = [...new Set(values.map((v) => String(v).trim()).filter(Boolean))];
  if (uniq.length === 0) return "";
  return `${OCT_MULTI_PREFIX}${uniq.join(",")}`;
}

export function decodeOctMultiSelection(
  raw: string | null | undefined,
): string[] {
  const t = String(raw ?? "").trim();
  if (!t.startsWith(OCT_MULTI_PREFIX)) return [];
  const rest = t.slice(OCT_MULTI_PREFIX.length).trim();
  if (!rest) return [];
  return [...new Set(rest.split(",").map((x) => x.trim()).filter(Boolean))];
}

/**
 * Özet metindeki `mai:<etiket>` parçalarını okunaklı etikete çevirir (liste/PDF UI).
 */
export function humanizeEmbeddedMaiPrefixes(text: string): string {
  if (!text.includes(MODALITY_AI_ALIGNED_PREFIX)) return text;
  return text.replace(/mai:([^·]+)/g, (_full, inner: string) => {
    const decoded = decodeModalityAiAlignedLabel(
      `${MODALITY_AI_ALIGNED_PREFIX}${String(inner).trim()}`,
    );
    return decoded ?? `${MODALITY_AI_ALIGNED_PREFIX}${String(inner).trim()}`;
  });
}
