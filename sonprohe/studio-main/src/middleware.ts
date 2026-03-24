import { NextResponse, type NextRequest } from "next/server";
import { DOCTOR_SESSION_COOKIE } from "@/lib/auth-constants";
import { canAccessDashboardPath, normalizeDoctorRole } from "@/lib/roles";

function decodeSessionRole(token?: string | null) {
  if (!token) return null;

  const [payload] = token.split(".");
  if (!payload) return null;

  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "=",
    );
    const json = atob(padded);
    const parsed = JSON.parse(json) as { role?: string };
    return normalizeDoctorRole(parsed.role);
  } catch {
    return null;
  }
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(DOCTOR_SESSION_COOKIE)?.value;
  const role = decodeSessionRole(token);
  const hasSession = Boolean(token);
  const requestId = req.headers.get("x-request-id") || crypto.randomUUID();
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-request-id", requestId);

  if (pathname.startsWith("/dashboard") && !hasSession) {
    const loginUrl = new URL("/login", req.url);
    const response = NextResponse.redirect(loginUrl);
    response.headers.set("x-request-id", requestId);
    return response;
  }

  if (pathname.startsWith("/dashboard") && role) {
    const allowed = canAccessDashboardPath(role, pathname);
    if (!allowed) {
      const targetUrl = new URL("/dashboard", req.url);
      targetUrl.searchParams.set("forbidden", "1");
      const response = NextResponse.redirect(targetUrl);
      response.headers.set("x-request-id", requestId);
      return response;
    }
  }

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  response.headers.set("x-request-id", requestId);
  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/register"],
};
