/**
 * AI upstream basarisiz oldugunda Next.js route'lari once "kuyruk" dener.
 * Asagidaki durumlarda kuyruk anlamsiz veya yanilticidir; dogrudan hata donulmeli:
 * - HTTP 4xx/5xx (JSON icindeki mesaj kullaniciya gider)
 * - 404: FFA/OCT endpoint'i yok (or. sadece app.py calisiyor) veya yanlis URL
 * - Baglanti / timeout (kuyruk da ayni URL'ye gidecek)
 */
export function aiFailureShouldBypassQueue(message: string): boolean {
  const m = message.toLowerCase();
  if (
    /\([4-5]\d{2}\)\s*:/.test(message) ||
    m.includes("quota") ||
    m.includes("ucretsiz kota") ||
    m.includes("resource_exhausted") ||
    m.includes("geminiquotaexceeded")
  ) {
    return true;
  }
  if (
    m.includes("econnrefused") ||
    m.includes("econnreset") ||
    m.includes("enotfound") ||
    m.includes("fetch failed") ||
    m.includes("failed to fetch") ||
    m.includes("network") ||
    m.includes("getaddrinfo") ||
    m.includes("socket") ||
    m.includes("yanit vermedi (timeout)") ||
    m.includes("timeout")
  ) {
    return true;
  }
  return false;
}
