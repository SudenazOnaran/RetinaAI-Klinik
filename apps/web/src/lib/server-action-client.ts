/** Next.js: deploy sonrası eski sekmede kalan istemci, sunucudaki yeni Server Action id ile eşleşmez. */
export function isStaleServerActionError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("server action") &&
    (m.includes("not found") || m.includes("was not found"))
  );
}
