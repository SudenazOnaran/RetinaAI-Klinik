import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { createDoctorSessionToken } from "@/lib/auth-session";
import { DOCTOR_SESSION_COOKIE } from "@/lib/auth-constants";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Eksik bilgi" }, { status: 400 });
    }
    const doctor = await prisma.doctor.findUnique({ where: { email } });
    if (!doctor) {
      return NextResponse.json({ error: "Doktor bulunamadı" }, { status: 404 });
    }
    const valid = await bcrypt.compare(password, doctor.password);
    if (!valid) {
      return NextResponse.json({ error: "Şifre hatalı" }, { status: 401 });
    }
    const response = NextResponse.json({
      success: true,
      doctor: { id: doctor.id, name: doctor.name, email: doctor.email },
    });

    response.cookies.set({
      name: DOCTOR_SESSION_COOKIE,
      value: createDoctorSessionToken({
        id: doctor.id,
        name: doctor.name,
        email: doctor.email,
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
            "Prisma istemcisi hatalı modda üretilmiş. `npx prisma generate` komutunu tekrar çalıştırın.",
        },
        { status: 503 },
      );
    }

    if (message.includes("Authentication failed against database server")) {
      return NextResponse.json(
        {
          error:
            "Veritabanı bağlantı bilgileri geçersiz. .env.local içindeki DATABASE_URL değerini kontrol edin.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
