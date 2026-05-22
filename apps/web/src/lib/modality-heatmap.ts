import type { ModalityAttentionRegion } from "@/components/dashboard/radiological-modality-blocks";

function coerceRegion(item: unknown): ModalityAttentionRegion | null {
  if (!item || typeof item !== "object") return null;
  const d = item as Record<string, unknown>;
  const x = Number(d.x);
  const y = Number(d.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const weight = Number(d.weight ?? d.agirlik ?? 0.7);
  const radiusRaw = d.radius ?? d.yaricap;
  const radius =
    radiusRaw !== undefined && Number.isFinite(Number(radiusRaw))
      ? Number(radiusRaw)
      : undefined;
  const label = String(d.label ?? d.etiket ?? "").trim() || undefined;
  return {
    x: Math.min(1, Math.max(0, x)),
    y: Math.min(1, Math.max(0, y)),
    weight: Math.min(1, Math.max(0, weight)),
    radius,
    label,
  };
}

export function parseModalityHeatmapFromApiResponse(
  data: Record<string, unknown>,
  modalityPayload?: Record<string, unknown> | null,
): { heatmapPlus: string | null; attentionRegions: ModalityAttentionRegion[] } {
  const heatmapRaw = data.heatmapPlus;
  const heatmapPlus =
    typeof heatmapRaw === "string" && heatmapRaw.trim().length > 0
      ? heatmapRaw.trim()
      : null;

  const rawRegions =
    data.attentionRegions ??
    modalityPayload?.attentionRegions ??
    data.dikkat_bolgeleri;

  const attentionRegions: ModalityAttentionRegion[] = [];
  if (Array.isArray(rawRegions)) {
    for (const item of rawRegions) {
      const r = coerceRegion(item);
      if (r) attentionRegions.push(r);
    }
  }

  return { heatmapPlus, attentionRegions };
}
