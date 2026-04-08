import { NextResponse } from "next/server";
import { getCurrentDoctorSession } from "@/lib/auth-session";
import { isRoleAllowed } from "@/lib/roles";
import { getRecentIntegrationEvents } from "@/lib/clinical-integrations";

export async function GET(request: Request) {
  const session = await getCurrentDoctorSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum bulunamadi" }, { status: 401 });
  }

  if (!isRoleAllowed(session.role, ["DOCTOR", "MANAGER"])) {
    return NextResponse.json({ error: "Yetkiniz yok" }, { status: 403 });
  }

  const url = new URL(request.url);
  const limitRaw = Number(url.searchParams.get("limit") || "30");
  const limit = Number.isFinite(limitRaw) ? limitRaw : 30;

  const events = await getRecentIntegrationEvents(session.id, limit);

  return NextResponse.json({
    success: true,
    events: events.map((event) => ({
      ...event,
      createdAt: event.createdAt.toISOString(),
    })),
  });
}
