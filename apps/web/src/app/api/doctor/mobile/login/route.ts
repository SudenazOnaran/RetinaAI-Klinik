import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { createDoctorSessionToken } from "@/lib/auth-session";
import { getDoctorCredentialPolicy } from "@/lib/credential-policy";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = typeof body?.email === "string" ? body.email.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!email || !password) {
      return NextResponse.json({ error: "Eksik bilgi" }, { status: 400 });
    }

    const doctor = await prisma.doctor.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
    });

    if (!doctor) {
      return NextResponse.json(
        { error: "E-posta veya şifre hatalı" },
        { status: 401 },
      );
    }

    if (!doctor.isActive) {
      return NextResponse.json(
        { error: "Hesabınız pasif durumda. Yönetici ile iletişime geçin." },
        { status: 403 },
      );
    }

    const approvalStatus = (doctor as Record<string, unknown>)
      .approvalStatus as string | undefined;
    if (approvalStatus === "PENDING") {
      return NextResponse.json(
        { error: "Hesabınız henüz onaylanmadı. Admin onayını bekleyiniz." },
        { status: 403 },
      );
    }
    if (approvalStatus === "REJECTED") {
      return NextResponse.json(
        { error: "Kayıt başvurunuz reddedilmiştir." },
        { status: 403 },
      );
    }

    const valid = await bcrypt.compare(password, doctor.password);
    if (!valid) {
      return NextResponse.json(
        { error: "E-posta veya şifre hatalı" },
        { status: 401 },
      );
    }

    const credentialPolicy = await getDoctorCredentialPolicy(doctor.id);
    if (credentialPolicy?.mustResetPassword) {
      return NextResponse.json(
        {
          error: "İlk girişte şifre yenileme zorunludur.",
          errorCode: "PASSWORD_RESET_REQUIRED",
        },
        { status: 403 },
      );
    }

    const token = createDoctorSessionToken({
      id: doctor.id,
      name: doctor.name,
      email: doctor.email,
      role: doctor.role,
    });

    return NextResponse.json({
      success: true,
      token,
      doctor: {
        id: doctor.id,
        name: doctor.name,
        surname: doctor.surname,
        email: doctor.email,
        role: doctor.role,
        specialty: doctor.specialty,
        hospital: doctor.hospital,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    if (
      message.includes("SESSION_SECRET") ||
      message.includes("NEXTAUTH_SECRET")
    ) {
      return NextResponse.json(
        { error: "Servis yapılandırma hatası.", errorCode: "SESSION_CONFIGURATION_ERROR" },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
