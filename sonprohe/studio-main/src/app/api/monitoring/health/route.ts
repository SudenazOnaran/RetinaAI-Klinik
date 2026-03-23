import { NextResponse } from "next/server";
import { checkSystemHealth } from "@/lib/monitoring-alerts";

export async function GET() {
  const health = await checkSystemHealth();

  return NextResponse.json(health, {
    status: health.ok ? 200 : 503,
  });
}
