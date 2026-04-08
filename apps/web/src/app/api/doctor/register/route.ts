import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import {
  isRoleAllowed,
  normalizeDoctorRole,
  type DoctorRole,
} from "@/lib/roles";
import { getCurrentDoctorSession } from "@/lib/auth-session";
import { logAuditEvent } from "@/lib/audit-log";
import {
  buildTemporaryPasswordExpiryDate,
  upsertDoctorCredentialPolicy,
} from "@/lib/credential-policy";

function createTemporaryPassword() {
  const raw = randomBytes(9).toString("base64url");
  return `Tmp-${raw}`;
}

async function requireManagerSession() {
  const session = await getCurrentDoctorSession();
  if (!session) {
    return {
      error: NextResponse.json(
        {
          error:
            "Yeni hesap olusturma yetkisi icin yonetici oturumu gereklidir.",
        },
        { status: 401 },
      ),
    };
  }

  if (!isRoleAllowed(session.role, ["MANAGER" satisfies DoctorRole])) {
    return {
      error: NextResponse.json(
        {
          error: "Yeni hesap olusturma yetkisi sadece yonetici rolundedir.",
        },
        { status: 403 },
      ),
    };
  }

  return { session };
}

export async function GET() {
  try {
    const auth = await requireManagerSession();
    if (auth.error) return auth.error;

    const users = await prisma.$queryRaw<
      Array<{
        id: string;
        name: string;
        email: string;
        role: DoctorRole;
        isActive: boolean;
        createdAt: Date;
      }>
    >`
      SELECT
        "id",
        "name",
        "email",
        "role",
        "isActive",
        "createdAt"
      FROM "Doctor"
      ORDER BY "createdAt" DESC
    `;

    return NextResponse.json({ success: true, users });
  } catch (e) {
    console.error("Kullanici listesi hatasi:", e);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireManagerSession();
    if (auth.error) return auth.error;

    const session = auth.session;

    const { name, email, role, temporaryPassword } = await req.json();
    if (!name || !email) {
      console.warn("Eksik bilgi ile kayit denemesi");
      return NextResponse.json({ error: "Eksik bilgi" }, { status: 400 });
    }

    const existing = await prisma.doctor.findUnique({ where: { email } });
    if (existing) {
      console.warn("Zaten kayitli doktor ile deneme");
      return NextResponse.json(
        { error: "Bu e-posta ile kayıtlı doktor var" },
        { status: 409 },
      );
    }
    const normalizedRole = normalizeDoctorRole(role);

    const candidateTempPassword = String(temporaryPassword || "").trim();
    const finalTemporaryPassword =
      candidateTempPassword.length > 0
        ? candidateTempPassword
        : createTemporaryPassword();

    if (finalTemporaryPassword.length < 10) {
      return NextResponse.json(
        {
          error: "Gecici sifre en az 10 karakter olmalidir.",
        },
        { status: 400 },
      );
    }

    const hashed = await bcrypt.hash(finalTemporaryPassword, 10);

    const doctor = await prisma.doctor.create({
      data: {
        name,
        email,
        password: hashed,
        role: normalizedRole,
      },
    });

    await upsertDoctorCredentialPolicy(doctor.id, {
      mustResetPassword: true,
      temporaryPasswordExpiresAt: buildTemporaryPasswordExpiryDate(),
    });

    await logAuditEvent({
      doctorId: session.id,
      role: session.role,
      action: "CREATE",
      entityType: "SYSTEM",
      entityId: doctor.id,
      description: "Manager yeni kullanici hesabi olusturdu.",
      metadata: {
        createdDoctorId: doctor.id,
        createdRole: doctor.role,
      },
    });

    console.info("Doktor hesabi olusturuldu", {
      id: doctor.id,
      role: doctor.role,
    });
    return NextResponse.json({
      success: true,
      doctor: {
        id: doctor.id,
        name: doctor.name,
        email: doctor.email,
        role: doctor.role,
        isActive: true,
      },
      temporaryPasswordReturned: false,
      temporaryPasswordDelivery: "out_of_band_required",
    });
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
    console.error("Doktor kayıt hatası:", e);
    return NextResponse.json(
      { error: "Sunucu hatasi", errorCode: "INTERNAL_SERVER_ERROR" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await requireManagerSession();
    if (auth.error) return auth.error;

    const session = auth.session;
    const { doctorId, isActive } = await req.json();

    if (!doctorId || typeof isActive !== "boolean") {
      return NextResponse.json({ error: "Eksik bilgi" }, { status: 400 });
    }

    if (doctorId === session.id && !isActive) {
      return NextResponse.json(
        { error: "Kendi hesabinizi pasife alamazsiniz." },
        { status: 400 },
      );
    }

    await prisma.$executeRaw`
      UPDATE "Doctor"
      SET "isActive" = ${isActive}
      WHERE "id" = ${doctorId}
    `;

    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        name: string;
        email: string;
        role: DoctorRole;
        isActive: boolean;
      }>
    >`
      SELECT "id", "name", "email", "role", "isActive"
      FROM "Doctor"
      WHERE "id" = ${doctorId}
      LIMIT 1
    `;

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Kullanici bulunamadi." },
        { status: 404 },
      );
    }

    const updated = rows[0];

    await logAuditEvent({
      doctorId: session.id,
      role: session.role,
      action: "EDIT",
      entityType: "SYSTEM",
      entityId: updated.id,
      description: "Manager kullanici aktiflik durumunu guncelledi.",
      metadata: {
        targetDoctorId: updated.id,
        isActive: updated.isActive,
      },
    });

    return NextResponse.json({ success: true, doctor: updated });
  } catch (e) {
    console.error("Kullanici pasif etme hatasi:", e);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
