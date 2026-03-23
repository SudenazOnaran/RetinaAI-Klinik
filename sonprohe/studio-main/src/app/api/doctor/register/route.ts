import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { normalizeDoctorRole } from "@/lib/roles";

export async function POST(req: Request) {
  try {
    const { name, email, password, role } = await req.json();
    if (!name || !email || !password) {
      console.log("Eksik bilgi ile kayıt denemesi", { name, email });
      return NextResponse.json({ error: "Eksik bilgi" }, { status: 400 });
    }
    const existing = await prisma.doctor.findUnique({ where: { email } });
    if (existing) {
      console.log("Zaten kayıtlı doktor ile deneme", { email });
      return NextResponse.json(
        { error: "Bu e-posta ile kayıtlı doktor var" },
        { status: 409 },
      );
    }
    const normalizedRole = normalizeDoctorRole(role);

    const hashed = await bcrypt.hash(password, 10);
    const doctor = await prisma.doctor.create({
      data: { name, email, password: hashed, role: normalizedRole },
    });
    console.log("Doktor başarıyla kaydedildi:", {
      id: doctor.id,
      name: doctor.name,
      email: doctor.email,
    });
    return NextResponse.json({
      success: true,
      doctor: {
        id: doctor.id,
        name: doctor.name,
        email: doctor.email,
        role: doctor.role,
      },
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
    console.error("Doktor kayıt hatası:", e);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
