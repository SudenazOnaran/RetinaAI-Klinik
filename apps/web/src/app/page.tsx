import { redirect } from "next/navigation";

function marketingOrigin(): string {
  const fromEnv = process.env.MARKETING_ORIGIN?.trim();
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "development") {
    return "http://127.0.0.1:5173";
  }
  return "https://retina-ai.tech";
}

/** Uygulama kökü: klinik girişi değil, tanıtım (statik) site. */
export default function HomePage() {
  redirect(marketingOrigin());
}
