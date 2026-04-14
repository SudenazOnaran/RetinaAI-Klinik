import { NextResponse, type NextRequest } from "next/server";
import { DOCTOR_SESSION_COOKIE } from "@/lib/auth-constants";
import {
  canAccessDashboardPath,
  canAccessAdminPath,
  normalizeDoctorRole,
} from "@/lib/roles";

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
  if (pathname === "/en/login" || pathname === "/tr/login") {
    const target = new URL("/login", req.url);
    target.search = req.nextUrl.search;
    return NextResponse.redirect(target);
  }
  const token = req.cookies.get(DOCTOR_SESSION_COOKIE)?.value;
  const role = decodeSessionRole(token);
  const hasSession = Boolean(token);
  const requestId = req.headers.get("x-request-id") || crypto.randomUUID();
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-request-id", requestId);

  if (pathname.startsWith("/admin") && !hasSession) {
    const loginUrl = new URL("/login", req.url);
    const response = NextResponse.redirect(loginUrl);
    response.headers.set("x-request-id", requestId);
    return response;
  }

  if (pathname.startsWith("/admin") && role) {
    const allowed = canAccessAdminPath(role, pathname);
    if (!allowed) {
      const targetUrl = new URL("/login", req.url);
      const response = NextResponse.redirect(targetUrl);
      response.headers.set("x-request-id", requestId);
      return response;
    }
  }

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
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/login",
    "/register",
    "/doctor-register",
    "/en/login",
    "/tr/login",
  ],
};
