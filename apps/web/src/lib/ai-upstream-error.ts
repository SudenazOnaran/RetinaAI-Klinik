/**
 * Flask/Next HTML 404 veya JSON olmayan govdeyi kullanici mesajina cevirir
 * (toast'ta <!doctype> gostermeyi onler).
 */
export function formatAiUpstreamErrorBody(
  status: number,
  bodyText: string,
): string {
  const raw = bodyText.trim();
  if (!raw) {
    return status === 404
      ? "Endpoint bulunamadi (404). app_gemini.py /predict veya /predict-ffa calisiyor mu, AI_SERVICE_URL dogru mu kontrol edin."
      : `AI servisi yanıt vermedi (${status}).`;
  }
  if (/^<!doctype html/i.test(raw) || /^<html/i.test(raw)) {
    if (status === 404) {
      return "FFA/OCT endpoint'i bulunamadi (404). Gemini servisinde (app_gemini.py) bu yol acik olmali; ornek: http://127.0.0.1:5001/predict-ffa. Klasik app.py (5000) FFA sunmaz.";
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
