import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { DOCTOR_SESSION_COOKIE } from "@/lib/auth-constants";
import { DoctorRole, normalizeDoctorRole } from "@/lib/roles";

type DoctorSession = {
  id: string;
  name: string;
  email: string;
  role: DoctorRole;
  iat: number;
};

type DoctorIdentity = {
  id: string;
  name: string;
  email: string;
  role?: DoctorRole;
};

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret || !secret.trim()) {
    throw new Error(
      "SESSION_SECRET (veya NEXTAUTH_SECRET) tanimli degil. Uygulama guvenlik nedeniyle baslatilmiyor.",
    );
  }
  return secret;
}

function toBase64Url(input: string) {
  return Buffer.from(input, "utf8").toString("base64url");
}

function fromBase64Url(input: string) {
  return Buffer.from(input, "base64url").toString("utf8");
}

function signPayload(payload: string) {
  return createHmac("sha256", getSessionSecret())
    .update(payload)
    .digest("base64url");
}

export function createDoctorSessionToken(doctor: DoctorIdentity) {
  const payloadObj: DoctorSession = {
    id: doctor.id,
    name: doctor.name,
    email: doctor.email,
    role: normalizeDoctorRole(doctor.role),
    iat: Date.now(),
  };

  const payload = toBase64Url(JSON.stringify(payloadObj));
  const signature = signPayload(payload);
  return `${payload}.${signature}`;
}

export function verifyDoctorSessionToken(token?: string | null) {
  if (!token?.trim()) return null;
  const raw = token.trim();
  // Oturum jetonu: payload.imza (tek ayırıcı nokta). split(".") JWT ile karışmaz ama
  // imza tarafında nadir edge-case'lerde ilk noktadan bölüm daha güvenli.
  const dot = raw.indexOf(".");
  if (dot === -1) return null;
  const payload = raw.slice(0, dot);
  const signature = raw.slice(dot + 1);
  if (!payload || !signature) return null;

  const expectedSignature = signPayload(payload);

  const providedSigBuffer = Buffer.from(signature);
  const expectedSigBuffer = Buffer.from(expectedSignature);

  if (providedSigBuffer.length !== expectedSigBuffer.length) return null;
  if (!timingSafeEqual(providedSigBuffer, expectedSigBuffer)) return null;

  try {
    const parsed = JSON.parse(fromBase64Url(payload)) as DoctorSession;
    if (!parsed?.id || !parsed?.name || !parsed?.email) return null;
    return {
      ...parsed,
      role: normalizeDoctorRole(parsed.role),
    };
  } catch {
    return null;
  }
}

export async function getCurrentDoctorSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(DOCTOR_SESSION_COOKIE)?.value;
  return verifyDoctorSessionToken(token);
}

/** Mobil istemciler: nginx/bazı proxy'ler Authorization'ı düşürebilir; yedek başlık aynı token'ı taşır. */
export const MOBILE_SESSION_TOKEN_HEADER = "x-retina-mobile-token";

/** Mobile API: Authorization: Bearer <token> veya X-Retina-Mobile-Token: <token> */
export function getMobileDoctorSession(request: Request) {
  const authHeader = request.headers.get("authorization");
  let token: string | null = null;
  if (authHeader?.trim()) {
    const m = authHeader.trim().match(/^Bearer\s+(.+)$/i);
    token = m?.[1]?.trim() ?? null;
  }
  if (!token) {
    token = request.headers.get(MOBILE_SESSION_TOKEN_HEADER)?.trim() ?? null;
  }
  return verifyDoctorSessionToken(token);
}
