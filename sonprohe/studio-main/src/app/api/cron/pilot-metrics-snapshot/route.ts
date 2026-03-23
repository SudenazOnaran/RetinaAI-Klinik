import { NextResponse } from "next/server";
import { createMonthlyPilotSnapshotsForAllDoctors } from "@/lib/pilot-metrics";

type CronBody = {
  snapshotMonth?: string;
};

function isAuthorized(request: Request) {
  const expected = process.env.PILOT_METRICS_CRON_SECRET;
  if (!expected) return false;

  const authHeader = request.headers.get("authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim() === expected;
  }

  const xHeader = request.headers.get("x-cron-secret") || "";
  return xHeader.trim() === expected;
}

export async function POST(request: Request) {
  if (!process.env.PILOT_METRICS_CRON_SECRET) {
    return NextResponse.json(
      { error: "PILOT_METRICS_CRON_SECRET tanimli degil" },
      { status: 503 },
    );
  }

  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: "Yetkisiz cron cagrisi" },
      { status: 401 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as CronBody;
  const result = await createMonthlyPilotSnapshotsForAllDoctors(
    body.snapshotMonth,
  );

  return NextResponse.json({
    success: true,
    ...result,
  });
}
