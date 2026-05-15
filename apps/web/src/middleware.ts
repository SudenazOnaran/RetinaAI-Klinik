import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/** Edge middleware — auth-session import edilmez (node:crypto). auth-session.ts ile aynı isim. */
const MOBILE_SESSION_TOKEN_HEADER = "x-retina-mobile-token";

/**
 * x-request-id üretir. NextResponse.next({ request: { headers } }) ile
 * bazı kurulumlarda Authorization iletimi sorun çıkarabildiği için
 * kimlik doğrulama başlıkları açıkça korunur.
 */
export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);

  const authorization = request.headers.get("authorization");
  if (authorization) {
    requestHeaders.set("authorization", authorization);
  }
  const mobileToken = request.headers.get(MOBILE_SESSION_TOKEN_HEADER);
  if (mobileToken) {
    requestHeaders.set(MOBILE_SESSION_TOKEN_HEADER, mobileToken);
  }

  if (!requestHeaders.get("x-request-id")?.trim()) {
    requestHeaders.set("x-request-id", crypto.randomUUID());
  }
  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
