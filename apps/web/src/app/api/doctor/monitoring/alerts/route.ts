import { NextResponse } from "next/server";
import { getCurrentDoctorSession } from "@/lib/auth-session";
import { isRoleAllowed } from "@/lib/roles";
import { getMonitoringAlerts } from "@/lib/monitoring-alerts";

export async function GET(request: Request) {
  const session = await getCurrentDoctorSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum bulunamadi" }, { status: 401 });
  }

  if (!isRoleAllowed(session.role, ["MANAGER", "AUDITOR"])) {
    return NextResponse.json({ error: "Yetkiniz yok" }, { status: 403 });
  }

  const url = new URL(request.url);
  const limitRaw = Number(url.searchParams.get("limit") || "50");
  const limit = Number.isFinite(limitRaw) ? limitRaw : 50;

  const alerts = await getMonitoringAlerts({ limit });

  return NextResponse.json({
    success: true,
    alerts: alerts.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
    })),
  });
}
