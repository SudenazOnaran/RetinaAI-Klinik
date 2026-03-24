import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  getDoctorCredentialPolicy,
  upsertDoctorCredentialPolicy,
} from "@/lib/credential-policy";

function validateNewPassword(value: string) {
  if (value.length < 10) return false;
  const hasUpper = /[A-Z]/.test(value);
  const hasLower = /[a-z]/.test(value);
  const hasDigit = /\d/.test(value);
  return hasUpper && hasLower && hasDigit;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body?.email || "")
      .trim()
      .toLowerCase();
    const temporaryPassword = String(body?.temporaryPassword || "");
    const newPassword = String(body?.newPassword || "");

    if (!email || !temporaryPassword || !newPassword) {
      return NextResponse.json({ error: "Eksik bilgi" }, { status: 400 });
    }

    if (!validateNewPassword(newPassword)) {
      return NextResponse.json(
        {
          error:
            "Yeni sifre en az 10 karakter olmali ve buyuk harf, kucuk harf, rakam icermelidir.",
        },
        { status: 400 },
      );
    }

    const doctor = await prisma.doctor.findUnique({ where: { email } });
    if (!doctor) {
      return NextResponse.json(
        { error: "E-posta veya gecici sifre hatali" },
        { status: 401 },
      );
    }

    const policy = await getDoctorCredentialPolicy(doctor.id);
    if (!policy?.mustResetPassword) {
      return NextResponse.json(
        { error: "Bu hesap icin gecici sifre yenileme gerekli degil." },
        { status: 400 },
      );
    }

    if (
      policy.temporaryPasswordExpiresAt &&
      policy.temporaryPasswordExpiresAt.getTime() <= Date.now()
    ) {
      return NextResponse.json(
        {
          error: "Gecici sifre suresi dolmus. Yonetici ile iletisime gecin.",
          errorCode: "TEMP_PASSWORD_EXPIRED",
        },
        { status: 403 },
      );
    }

    const validTempPassword = await bcrypt.compare(
      temporaryPassword,
      doctor.password,
    );
    if (!validTempPassword) {
      return NextResponse.json(
        { error: "E-posta veya gecici sifre hatali" },
        { status: 401 },
      );
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.doctor.update({
      where: { id: doctor.id },
      data: { password: hashed },
    });

    await upsertDoctorCredentialPolicy(doctor.id, {
      mustResetPassword: false,
      temporaryPasswordExpiresAt: null,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Sunucu hatasi" }, { status: 500 });
  }
}
