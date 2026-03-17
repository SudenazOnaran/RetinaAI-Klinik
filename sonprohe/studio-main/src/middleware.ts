import { NextResponse, type NextRequest } from "next/server";
import { DOCTOR_SESSION_COOKIE } from "@/lib/auth-constants";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = Boolean(req.cookies.get(DOCTOR_SESSION_COOKIE)?.value);

  if (pathname.startsWith("/dashboard") && !hasSession) {
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/register"],
};
