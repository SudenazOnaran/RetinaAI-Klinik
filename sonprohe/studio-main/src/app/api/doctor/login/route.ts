import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { createDoctorSessionToken } from "@/lib/auth-session";
import { DOCTOR_SESSION_COOKIE } from "@/lib/auth-constants";
import { getDoctorCredentialPolicy } from "@/lib/credential-policy";

type LoginAttemptState = {
  count: number;
  windowStartedAt: Date;
  lockedUntil: Date | null;
};

function isLoginAttemptStorageError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  const normalized = message.toLowerCase();

  return (
    normalized.includes("loginattempt") &&
    (normalized.includes("does not exist") ||
      normalized.includes("relation") ||
      normalized.includes("column") ||
      normalized.includes("p2021") ||
      normalized.includes("p2010"))
  );
}

function getEnvNumber(name: string, fallback: number, min: number) {
  const raw = Number(process.env[name] || String(fallback));
  if (!Number.isFinite(raw)) return fallback;
  return Math.max(min, Math.floor(raw));
}

function getClientIp(req: Request) {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown-ip";
  }
  return req.headers.get("x-real-ip") || "unknown-ip";
}

function getRateLimitConfig() {
  return {
    windowSeconds: getEnvNumber("LOGIN_RATE_LIMIT_WINDOW_SECONDS", 300, 30),
    maxAttempts: getEnvNumber("LOGIN_MAX_ATTEMPTS", 5, 2),
    lockoutSeconds: getEnvNumber("LOGIN_LOCKOUT_SECONDS", 900, 30),
  };
}

function getAttemptKey(req: Request, email: string) {
  return `${getClientIp(req)}::${email.trim().toLowerCase()}`;
}

async function getAttemptState(key: string): Promise<LoginAttemptState | null> {
  const rows = await prisma.$queryRaw<
    Array<{
      failedCount: number;
      windowStartedAt: Date;
      lockedUntil: Date | null;
    }>
  >`
    SELECT
      "failedCount" as "failedCount",
      "windowStartedAt" as "windowStartedAt",
      "lockedUntil" as "lockedUntil"
    FROM "LoginAttempt"
    WHERE "key" = ${key}
    LIMIT 1
  `;

  if (rows.length === 0) return null;

  return {
    count: Number(rows[0].failedCount || 0),
    windowStartedAt: rows[0].windowStartedAt,
    lockedUntil: rows[0].lockedUntil,
  };
}

function getLockoutRemainingSeconds(lockedUntil: Date, now: Date) {
  return Math.max(1, Math.ceil((lockedUntil.getTime() - now.getTime()) / 1000));
}

async function registerFailedAttempt(key: string, now: Date) {
  const { windowSeconds, maxAttempts, lockoutSeconds } = getRateLimitConfig();
  const state = await getAttemptState(key);
  const windowMs = windowSeconds * 1000;
  const nowMs = now.getTime();

  if (!state) {
    await prisma.$executeRaw`
      INSERT INTO "LoginAttempt" (
        "key",
        "failedCount",
        "windowStartedAt",
        "lockedUntil",
        "updatedAt"
      )
      VALUES (
        ${key},
        1,
        ${now},
        ${null},
        CURRENT_TIMESTAMP
      )
      ON CONFLICT ("key") DO UPDATE
      SET
        "failedCount" = EXCLUDED."failedCount",
        "windowStartedAt" = EXCLUDED."windowStartedAt",
        "lockedUntil" = EXCLUDED."lockedUntil",
        "updatedAt" = CURRENT_TIMESTAMP
    `;

    return { locked: false, retryAfterSeconds: 0 };
  }

  if (state.lockedUntil && state.lockedUntil.getTime() > nowMs) {
    return {
      locked: true,
      retryAfterSeconds: getLockoutRemainingSeconds(state.lockedUntil, now),
    };
  }

  const windowExpired =
    nowMs - state.windowStartedAt.getTime() > windowMs ||
    (state.lockedUntil !== null && state.lockedUntil.getTime() <= nowMs);

  const nextCount = windowExpired ? 1 : state.count + 1;
  const shouldLock = nextCount >= maxAttempts;
  const nextLockedUntil = shouldLock
    ? new Date(nowMs + lockoutSeconds * 1000)
    : null;
  const nextCountPersisted = shouldLock ? 0 : nextCount;

  await prisma.$executeRaw`
    UPDATE "LoginAttempt"
    SET
      "failedCount" = ${nextCountPersisted},
      "windowStartedAt" = ${windowExpired ? now : state.windowStartedAt},
      "lockedUntil" = ${nextLockedUntil},
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "key" = ${key}
  `;

  if (shouldLock) {
    return {
      locked: true,
      retryAfterSeconds: lockoutSeconds,
    };
  }

  return { locked: false, retryAfterSeconds: 0 };
}

async function clearAttempts(key: string) {
  await prisma.$executeRaw`
    DELETE FROM "LoginAttempt"
    WHERE "key" = ${key}
  `;
}

async function getAttemptStateSafe(
  key: string,
): Promise<LoginAttemptState | null> {
  try {
    return await getAttemptState(key);
  } catch (error) {
    if (isLoginAttemptStorageError(error)) {
      return null;
    }
    throw error;
  }
}

async function registerFailedAttemptSafe(key: string, now: Date) {
  try {
    return await registerFailedAttempt(key, now);
  } catch (error) {
    if (isLoginAttemptStorageError(error)) {
      return { locked: false, retryAfterSeconds: 0 };
    }
    throw error;
  }
}

async function clearAttemptsSafe(key: string) {
  try {
    await clearAttempts(key);
  } catch (error) {
    if (isLoginAttemptStorageError(error)) {
      return;
    }
    throw error;
  }
}

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Eksik bilgi" }, { status: 400 });
    }

    const now = new Date();
    const attemptKey = getAttemptKey(req, String(email));
    const currentState = await getAttemptStateSafe(attemptKey);

    if (currentState?.lockedUntil && currentState.lockedUntil > now) {
      const retryAfterSeconds = getLockoutRemainingSeconds(
        currentState.lockedUntil,
        now,
      );
      return NextResponse.json(
        {
          error:
            "Cok fazla hatali giris denemesi algilandi. Lutfen daha sonra tekrar deneyin.",
          retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfterSeconds),
          },
        },
      );
    }

    const doctor = await prisma.doctor.findUnique({ where: { email } });
    if (!doctor) {
      const failed = await registerFailedAttemptSafe(attemptKey, now);
      if (failed.locked) {
        return NextResponse.json(
          {
            error:
              "Cok fazla hatali giris denemesi algilandi. Lutfen daha sonra tekrar deneyin.",
            retryAfterSeconds: failed.retryAfterSeconds,
          },
          {
            status: 429,
            headers: {
              "Retry-After": String(failed.retryAfterSeconds),
            },
          },
        );
      }
      return NextResponse.json(
        { error: "E-posta veya şifre hatalı" },
        { status: 401 },
      );
    }

    if (!doctor.isActive) {
      return NextResponse.json(
        { error: "Hesabiniz pasif durumda. Yonetici ile iletisime gecin." },
        { status: 403 },
      );
    }

    const valid = await bcrypt.compare(password, doctor.password);
    if (!valid) {
      const failed = await registerFailedAttemptSafe(attemptKey, now);
      if (failed.locked) {
        return NextResponse.json(
          {
            error:
              "Cok fazla hatali giris denemesi algilandi. Lutfen daha sonra tekrar deneyin.",
            retryAfterSeconds: failed.retryAfterSeconds,
          },
          {
            status: 429,
            headers: {
              "Retry-After": String(failed.retryAfterSeconds),
            },
          },
        );
      }
      return NextResponse.json(
        { error: "E-posta veya şifre hatalı" },
        { status: 401 },
      );
    }

    const credentialPolicy = await getDoctorCredentialPolicy(doctor.id);
    if (credentialPolicy?.mustResetPassword) {
      const nowTs = now.getTime();
      const expiresAtTs =
        credentialPolicy.temporaryPasswordExpiresAt?.getTime();

      if (expiresAtTs && expiresAtTs <= nowTs) {
        return NextResponse.json(
          {
            error:
              "Gecici sifrenin suresi doldu. Yonetici ile iletisime gecerek yeni gecici sifre alin.",
            errorCode: "TEMP_PASSWORD_EXPIRED",
          },
          { status: 403 },
        );
      }

      return NextResponse.json(
        {
          error:
            "Ilk giriste sifre yenileme zorunludur. Lutfen gecici sifreyi degistirin.",
          errorCode: "PASSWORD_RESET_REQUIRED",
        },
        { status: 403 },
      );
    }

    await clearAttemptsSafe(attemptKey);

    const response = NextResponse.json({
      success: true,
      doctor: {
        id: doctor.id,
        name: doctor.name,
        email: doctor.email,
        role: doctor.role,
      },
    });

    response.cookies.set({
      name: DOCTOR_SESSION_COOKIE,
      value: createDoctorSessionToken({
        id: doctor.id,
        name: doctor.name,
        email: doctor.email,
        role: doctor.role,
      }),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    if (
      message.includes("the URL must start with the protocol `prisma://`") ||
      message.includes("prisma+postgres://")
    ) {
      return NextResponse.json(
        {
          error:
            "Servis gecici olarak kullanilamiyor. Lutfen daha sonra tekrar deneyin.",
          errorCode: "SERVICE_CONFIGURATION_ERROR",
        },
        { status: 503 },
      );
    }

    if (message.includes("Authentication failed against database server")) {
      return NextResponse.json(
        {
          error:
            "Servis gecici olarak kullanilamiyor. Lutfen daha sonra tekrar deneyin.",
          errorCode: "DATABASE_UNAVAILABLE",
        },
        { status: 503 },
      );
    }

    if (
      message.includes("SESSION_SECRET") ||
      message.includes("NEXTAUTH_SECRET")
    ) {
      return NextResponse.json(
        {
          error:
            "Servis gecici olarak kullanilamiyor. Lutfen daha sonra tekrar deneyin.",
          errorCode: "SESSION_CONFIGURATION_ERROR",
        },
        { status: 503 },
      );
    }

    if (isLoginAttemptStorageError(e)) {
      return NextResponse.json(
        {
          error:
            "Servis gecici olarak kullanilamiyor. Lutfen daha sonra tekrar deneyin.",
          errorCode: "LOGIN_ATTEMPT_STORAGE_UNAVAILABLE",
        },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { error: "Sunucu hatasi", errorCode: "INTERNAL_SERVER_ERROR" },
      { status: 500 },
    );
  }
}
