/**
 * Flask/Next HTML 404 veya JSON olmayan govdeyi kullanici mesajina cevirir
 * (toast'ta <!doctype> gostermeyi onler).
 */
/** Sunucu JSON govdesinden kullaniciya uygun format hatasi (i18n disi, Ingilizce/Turkce ham metin). */
export function isUnsupportedImageFormatMessage(text: string): boolean {
  const low = (text || "").toLowerCase();
  return (
    low.includes("unsupported_image_format") ||
    low.includes("sadece jpg") ||
    low.includes("formatlari kabul") ||
    low.includes("gecersiz dosya tipi")
  );
}

export function formatAiUpstreamErrorBody(
  status: number,
  bodyText: string,
): string {
  const raw = bodyText.trim();
  if (!raw) {
    return status === 404
      ? "Endpoint bulunamadi (404). OCT/FFA icin app_gemini.py (ornek port 5001) calismali; fundus 5000 (app.py) ise AI_OCT_SERVICE_URL / AI_FFA_SERVICE_URL veya AI_SERVICE_URL=5001 kullanin."
      : `AI servisi yanıt vermedi (${status}).`;
  }
  if (/^<!doctype html/i.test(raw) || /^<html/i.test(raw)) {
    if (status === 404) {
      return "FFA/OCT endpoint'i bulunamadi (404). Muhtemel neden: istek app.py (port 5000) adresine gidiyor; OCT/FFA yalnizca app_gemini (port 5001) uzerinde. retinai-gemini-ai servisini ve AI_SERVICE_URL / AI_OCT_SERVICE_URL ayarlarini kontrol edin.";
    }
    return `AI servisi HTML hata sayfasi dondurdu (${status}). URL ve AI_GATEWAY_SHARED_SECRET ayarlarini kontrol edin.`;
  }
  try {
    const j = JSON.parse(raw) as { error?: string; message?: string };
    const msg = j.error ?? j.message;
    if (typeof msg === "string" && msg.trim()) return msg.trim();
  } catch {
    /* JSON degil */
  }
  const stripped = raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (stripped.length > 400) return `${stripped.slice(0, 400)}…`;
  return stripped || `AI servisi hatasi (${status}).`;
}
