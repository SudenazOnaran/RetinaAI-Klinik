import { NextResponse } from "next/server";
import { checkSystemHealth } from "@/lib/monitoring-alerts";
import {
  getRequestId,
  logError,
  logInfo,
  requestIdHeaders,
} from "@/lib/structured-logger";

function hasDetailedHealthAccess(request: Request) {
  const expectedToken = process.env.INTERNAL_HEALTH_TOKEN;

  if (!expectedToken) {
    return false;
  }

  const incomingToken = request.headers.get("x-monitoring-token");
  return incomingToken === expectedToken;
}

export async function GET(request: Request) {
  const requestId = getRequestId(request);

  try {
    const health = await checkSystemHealth();
    const url = new URL(request.url);
    const wantsDetailed = url.searchParams.get("details") === "1";
    const canViewDetailed = wantsDetailed && hasDetailedHealthAccess(request);

    logInfo({
      message: "health_check",
      requestId,
      route: "/api/monitoring/health",
      metadata: {
        detailed: canViewDetailed,
        ok: health.ok,
      },
    });

    if (!canViewDetailed) {
      return NextResponse.json(
        {
          ok: health.ok,
          status: health.ok ? "ok" : "degraded",
          timestamp: health.timestamp,
        },
        {
          status: health.ok ? 200 : 503,
          headers: requestIdHeaders(requestId),
        },
      );
    }

    return NextResponse.json(health, {
      status: health.ok ? 200 : 503,
      headers: requestIdHeaders(requestId),
    });
  } catch (error) {
    logError({
      message: "health_check_failed",
      requestId,
      route: "/api/monitoring/health",
      error,
    });

    return NextResponse.json(
      {
        ok: false,
        status: "down",
      },
      {
        status: 503,
        headers: requestIdHeaders(requestId),
      },
    );
  }
}
