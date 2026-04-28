/**
 * Puppeteer / sunucu PDF renderında göreli `/api/storage/...` yollarının yüklenmesi için
 * istek köküne göre mutlak URL üretir.
 */
export function resolveAbsoluteMediaUrlForPdf(
  href: string | null | undefined,
): string | null {
  const u = String(href ?? "").trim();
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) return u;
  if (u.startsWith("data:")) return u;

  const fromEnv =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL.replace(/^\/\//, "")}`
      : "");
  const base =
    fromEnv ||
    (process.env.NODE_ENV === "development" ? "http://localhost:9002" : "");
  if (!base) return u;
  return `${base}${u.startsWith("/") ? "" : "/"}${u}`;
}
