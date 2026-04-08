import { redirect } from "next/navigation";
import { getCurrentDoctorSession } from "@/lib/auth-session";

export default async function PilotMetricsPage() {
  const session = await getCurrentDoctorSession();
  if (!session) {
    redirect("/login");
  }

  redirect("/dashboard");

  return null;
}
