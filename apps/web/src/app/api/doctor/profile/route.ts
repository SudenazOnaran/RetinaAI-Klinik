import { NextResponse } from "next/server";
import { createHash, randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getCurrentDoctorSession } from "@/lib/auth-session";
import { isRoleAllowed } from "@/lib/roles";
import {
  getDefaultRetinaSettings,
  normalizeRetinaSettings,
  RetinaSettings,
} from "@/lib/retina-settings";

type DoctorSettingsRow = {
  settings: unknown;
};

type DoctorSettingsJson = Partial<RetinaSettings> & {
  security?: {
    profileUpdateVerification?: {
      codeHash: string;
      payloadHash: string;
      channel: "email" | "phone";
      target: string;
      expiresAt: string;
      attempts: number;
    } | null;
  };
};

type ProfilePayload = {
  fullName?: string;
  email?: string;
  branch?: string;
  licenseNo?: string;
  contactPhone?: string;
  signatureName?: string;
  verificationCode?: string;
  channel?: "email" | "phone";
};

function cleanText(value: string | undefined, maxLength: number) {
  return String(value || "")
    .trim()
    .slice(0, maxLength);
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidName(name: string) {
  return name.length >= 3 && name.length <= 80;
}

function isValidPhone(phone: string) {
  return /^[0-9+()\-\s]{10,24}$/.test(phone);
}

function hashText(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function buildNormalizedProfile(payload: ProfilePayload) {
  const fullName = cleanText(payload.fullName, 80);
  const email = cleanText(payload.email, 120).toLowerCase();
  const branch = cleanText(payload.branch, 80);
  const licenseNo = cleanText(payload.licenseNo, 40);
  const contactPhone = cleanText(payload.contactPhone, 24);
  const signatureName = cleanText(payload.signatureName, 80);

  return {
    fullName,
    email,
    branch,
    licenseNo,
    contactPhone,
    signatureName,
  };
}

function validateNormalizedProfile(
  input: ReturnType<typeof buildNormalizedProfile>,
) {
  if (!isValidName(input.fullName)) {
    return "Doktor adı 3-80 karakter aralığında olmalıdır";
  }

  if (!isValidEmail(input.email)) {
    return "Geçerli bir e-posta adresi giriniz";
  }

  if (!input.contactPhone) {
    return "Telefon numarası zorunludur";
  }

  if (!isValidPhone(input.contactPhone)) {
    return "Telefon numarası formatı geçersiz";
  }

  return null;
}

function buildPayloadHash(input: ReturnType<typeof buildNormalizedProfile>) {
  return hashText(
    JSON.stringify({
      fullName: input.fullName,
      email: input.email,
      branch: input.branch,
      licenseNo: input.licenseNo,
      contactPhone: input.contactPhone,
      signatureName: input.signatureName || input.fullName,
    }),
  );
}

function buildOneTimeCode() {
  return String(randomInt(100000, 1000000));
}

function isExpired(expiresAtIso: string) {
  return new Date(expiresAtIso).getTime() <= Date.now();
}

function maskTarget(target: string, channel: "email" | "phone") {
  if (channel === "email") {
    const [namePart = "", domainPart = ""] = target.split("@");
    if (!domainPart) return "***";
    const safeName =
      namePart.length <= 2
        ? `${namePart[0] || "*"}*`
        : `${namePart.slice(0, 2)}***`;
    return `${safeName}@${domainPart}`;
  }

  return `${"*".repeat(Math.max(0, target.length - 4))}${target.slice(-4)}`;
}

type DispatchResult =
  | {
      success: true;
      devVerificationCode?: string;
    }
  | {
      success: false;
      error: string;
    };

async function dispatchVerificationCode(params: {
  channel: "email" | "phone";
  target: string;
  code: string;
  expiresAt: string;
}): Promise<DispatchResult> {
  const { channel, target, code, expiresAt } = params;
  const isDev = process.env.NODE_ENV !== "production";

  if (isDev) {
    return {
      success: true,
      devVerificationCode: code,
    };
  }

  const webhookUrl =
    channel === "email"
      ? (process.env.PROFILE_VERIFY_EMAIL_WEBHOOK_URL || "").trim()
      : (process.env.PROFILE_VERIFY_SMS_WEBHOOK_URL || "").trim();

  if (!webhookUrl) {
    return {
      success: false,
      error:
        channel === "email"
          ? "E-posta doğrulama servisi yapılandırılmamış"
          : "SMS doğrulama servisi yapılandırılmamış",
    };
  }

  const webhookToken = (process.env.PROFILE_VERIFY_WEBHOOK_TOKEN || "").trim();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (webhookToken) {
    headers.Authorization = `Bearer ${webhookToken}`;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        event: "doctor_profile_update_verification",
        channel,
        target,
        code,
        expiresAt,
        ttlSeconds: 300,
        message:
          code +
          " doğrulama kodu ile doktor profilinizi güncelleyebilirsiniz. Kod 5 dakika geçerlidir.",
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        success: false,
        error: "Doğrulama kodu ilgili kanala iletilemedi",
      };
    }

    return { success: true };
  } catch {
    return {
      success: false,
      error: "Doğrulama servisine erişilemedi",
    };
  }
}

async function saveVerificationChallenge(
  doctorId: string,
  settings: RetinaSettings,
  challenge: NonNullable<
    DoctorSettingsJson["security"]
  >["profileUpdateVerification"],
) {
  const nextSettings: DoctorSettingsJson = {
    ...settings,
    security: {
      ...(settings as DoctorSettingsJson).security,
      profileUpdateVerification: challenge,
    },
  };

  await prisma.$queryRaw`
    INSERT INTO "DoctorSettings" (
      "id",
      "doctorId",
      "settings",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${doctorId},
      ${doctorId},
      ${JSON.stringify(nextSettings)}::jsonb,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT ("doctorId")
    DO UPDATE SET
      "settings" = EXCLUDED."settings",
      "updatedAt" = CURRENT_TIMESTAMP
  `;
}

export async function GET() {
  const session = await getCurrentDoctorSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum bulunamadı" }, { status: 401 });
  }

  const doctor = await prisma.doctor.findUnique({
    where: { id: session.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });

  if (!doctor) {
    return NextResponse.json({ error: "Doktor bulunamadı" }, { status: 404 });
  }

  const rows = await prisma.$queryRaw<DoctorSettingsRow[]>`
    SELECT "settings"
    FROM "DoctorSettings"
    WHERE "doctorId" = ${session.id}
    LIMIT 1
  `;

  const settings = normalizeRetinaSettings(
    (rows[0]?.settings as Partial<RetinaSettings> | undefined) ??
      getDefaultRetinaSettings(),
  );

  const profile = {
    fullName: doctor.name,
    email: doctor.email,
    branch: settings.doctor.branch,
    licenseNo: settings.doctor.licenseNo,
    contactPhone: settings.doctor.contactPhone,
    signatureName: settings.doctor.signatureName || doctor.name,
  };

  return NextResponse.json({
    success: true,
    doctor: {
      ...doctor,
      createdAt: doctor.createdAt.toISOString(),
    },
    profile,
  });
}

export async function PUT(req: Request) {
  const session = await getCurrentDoctorSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum bulunamadı" }, { status: 401 });
  }

  if (!isRoleAllowed(session.role, ["DOCTOR", "MANAGER"])) {
    return NextResponse.json({ error: "Yetkiniz yok" }, { status: 403 });
  }

  const body = (await req.json()) as ProfilePayload;
  const normalized = buildNormalizedProfile(body);
  const verificationCode = cleanText(body.verificationCode, 12);

  const validationError = validateNormalizedProfile(normalized);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  if (!verificationCode) {
    return NextResponse.json(
      { error: "Doğrulama kodu olmadan güncelleme yapılamaz" },
      { status: 400 },
    );
  }

  const existingEmail = await prisma.doctor.findFirst({
    where: {
      email: normalized.email,
      id: { not: session.id },
    },
    select: { id: true },
  });

  if (existingEmail) {
    return NextResponse.json(
      { error: "Bu e-posta adresi başka bir hesap tarafından kullanılıyor" },
      { status: 409 },
    );
  }

  const settingsRows = await prisma.$queryRaw<DoctorSettingsRow[]>`
    SELECT "settings"
    FROM "DoctorSettings"
    WHERE "doctorId" = ${session.id}
    LIMIT 1
  `;

  const mergedSettings = normalizeRetinaSettings(
    (settingsRows[0]?.settings as Partial<RetinaSettings> | undefined) ??
      getDefaultRetinaSettings(),
  );

  const settingsWithSecurity = mergedSettings as DoctorSettingsJson;
  const challenge = settingsWithSecurity.security?.profileUpdateVerification;
  const payloadHash = buildPayloadHash(normalized);

  if (!challenge) {
    return NextResponse.json(
      { error: "Önce e-posta veya telefon doğrulama kodu alınmalıdır" },
      { status: 400 },
    );
  }

  if (isExpired(challenge.expiresAt)) {
    await saveVerificationChallenge(session.id, mergedSettings, null);
    return NextResponse.json(
      { error: "Doğrulama kodunun süresi doldu. Yeni kod isteyin" },
      { status: 410 },
    );
  }

  if (challenge.payloadHash !== payloadHash) {
    return NextResponse.json(
      {
        error:
          "Doğrulama kodu mevcut değişikliklerle eşleşmiyor. Lütfen yeniden kod isteyin",
      },
      { status: 409 },
    );
  }

  const incomingCodeHash = hashText(verificationCode);
  if (incomingCodeHash !== challenge.codeHash) {
    const nextAttempts = (challenge.attempts || 0) + 1;
    const tooManyAttempts = nextAttempts >= 5;
    await saveVerificationChallenge(
      session.id,
      mergedSettings,
      tooManyAttempts
        ? null
        : {
            ...challenge,
            attempts: nextAttempts,
          },
    );

    return NextResponse.json(
      {
        error: tooManyAttempts
          ? "Çok fazla hatalı doğrulama denemesi yapıldı. Yeni kod alın"
          : "Doğrulama kodu geçersiz",
      },
      { status: 401 },
    );
  }

  mergedSettings.doctor = {
    fullName: normalized.fullName,
    branch: normalized.branch,
    licenseNo: normalized.licenseNo,
    contactPhone: normalized.contactPhone,
    signatureName: normalized.signatureName || normalized.fullName,
  };

  const persistedSettings: DoctorSettingsJson = {
    ...mergedSettings,
    security: {
      ...(mergedSettings as DoctorSettingsJson).security,
      profileUpdateVerification: null,
    },
  };

  const [updatedDoctor] = await prisma.$transaction([
    prisma.doctor.update({
      where: { id: session.id },
      data: { name: normalized.fullName, email: normalized.email },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    }),
    prisma.$queryRaw`
      INSERT INTO "DoctorSettings" (
        "id",
        "doctorId",
        "settings",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        ${session.id},
        ${session.id},
        ${JSON.stringify(persistedSettings)}::jsonb,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT ("doctorId")
      DO UPDATE SET
        "settings" = EXCLUDED."settings",
        "updatedAt" = CURRENT_TIMESTAMP
    `,
  ]);

  return NextResponse.json({
    success: true,
    doctor: {
      ...updatedDoctor,
      createdAt: updatedDoctor.createdAt.toISOString(),
    },
    profile: persistedSettings.doctor,
  });
}

export async function POST(req: Request) {
  const session = await getCurrentDoctorSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum bulunamadı" }, { status: 401 });
  }

  return NextResponse.json(
    { error: "Profil doğrulama akışı kapalıdır" },
    { status: 403 },
  );

  if (!isRoleAllowed(session.role, ["DOCTOR", "MANAGER"])) {
    return NextResponse.json({ error: "Yetkiniz yok" }, { status: 403 });
  }

  const body = (await req.json()) as ProfilePayload;
  const channel = body.channel === "phone" ? "phone" : "email";
  const normalized = buildNormalizedProfile(body);

  const validationError = validateNormalizedProfile(normalized);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const target =
    channel === "email" ? normalized.email : normalized.contactPhone;
  if (!target) {
    return NextResponse.json(
      { error: "Doğrulama hedefi belirlenemedi" },
      { status: 400 },
    );
  }

  const code = buildOneTimeCode();
  const payloadHash = buildPayloadHash(normalized);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  const dispatchResult = await dispatchVerificationCode({
    channel,
    target,
    code,
    expiresAt,
  });

  if (!dispatchResult.success) {
    return NextResponse.json({ error: dispatchResult.error }, { status: 503 });
  }

  const rows = await prisma.$queryRaw<DoctorSettingsRow[]>`
    SELECT "settings"
    FROM "DoctorSettings"
    WHERE "doctorId" = ${session.id}
    LIMIT 1
  `;

  const settings = normalizeRetinaSettings(
    (rows[0]?.settings as Partial<RetinaSettings> | undefined) ??
      getDefaultRetinaSettings(),
  );

  await saveVerificationChallenge(session.id, settings, {
    codeHash: hashText(code),
    payloadHash,
    channel,
    target,
    expiresAt,
    attempts: 0,
  });

  const isDev = Boolean(dispatchResult.devVerificationCode);

  if (!isDev) {
    return NextResponse.json(
      {
        success: true,
        channel,
        maskedTarget: maskTarget(target, channel),
        expiresAt,
        message:
          "Doğrulama kodu gönderildi. Kodu ilgili kanal üzerinden girerek güncellemeyi tamamlayın.",
      },
      { status: 200 },
    );
  }

  return NextResponse.json({
    success: true,
    channel,
    maskedTarget: maskTarget(target, channel),
    expiresAt,
    devVerificationCode: dispatchResult.devVerificationCode,
    message:
      "Geliştirme modunda doğrulama kodu API yanıtına eklendi. Üretimde kanal entegrasyonu gereklidir.",
  });
}
