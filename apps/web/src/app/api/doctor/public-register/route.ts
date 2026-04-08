import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const { name, surname, email, password, specialty, hospital } =
      await req.json();

    if (!name || !surname || !email || !password || !specialty || !hospital) {
      return NextResponse.json({ error: "Tüm alanlar zorunludur." }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Şifre en az 8 karakter olmalıdır." },
        { status: 400 },
      );
    }

    const existing = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "Doctor" WHERE "email" = ${email} LIMIT 1
    `;
    if (existing.length > 0) {
      return NextResponse.json(
        { error: "Bu e-posta adresi ile kayıtlı bir hesap bulunmaktadır." },
        { status: 409 },
      );
    }

    const hashed = await bcrypt.hash(password, 10);

    await prisma.$executeRaw`
      INSERT INTO "Doctor" (
        "id", "name", "surname", "email", "password",
        "specialty", "hospital", "role", "approvalStatus", "isActive", "createdAt"
      )
      VALUES (
        gen_random_uuid()::text,
        ${name},
        ${surname},
        ${email},
        ${hashed},
        ${specialty},
        ${hospital},
        'DOCTOR'::"DoctorRole",
        'PENDING'::"ApprovalStatus",
        false,
        CURRENT_TIMESTAMP
      )
    `;

    return NextResponse.json({
      success: true,
      message:
        "Kayıt başvurunuz alınmıştır. Admin onayından sonra sisteme giriş yapabilirsiniz.",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    if (
      message.includes("the URL must start with the protocol `prisma://`") ||
      message.includes("prisma+postgres://")
    ) {
      return NextResponse.json(
        { error: "Servis geçici olarak kullanılamıyor. Lütfen daha sonra tekrar deneyin." },
        { status: 503 },
      );
    }

    if (message.includes("Authentication failed against database server")) {
      return NextResponse.json(
        { error: "Servis geçici olarak kullanılamıyor. Lütfen daha sonra tekrar deneyin." },
        { status: 503 },
      );
    }

    console.error("Doktor kayıt hatası:", e);
    return NextResponse.json(
      { error: "Sunucu hatası oluştu." },
      { status: 500 },
    );
  }
}
