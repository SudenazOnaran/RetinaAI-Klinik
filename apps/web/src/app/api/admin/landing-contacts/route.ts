import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentDoctorSession } from "@/lib/auth-session";

async function requireAdminSession() {
  const session = await getCurrentDoctorSession();
  if (!session) {
    return {
      error: NextResponse.json(
        { error: "Oturum bulunamadı." },
        { status: 401 },
      ),
    };
  }
  if (session.role !== "ADMIN") {
    return {
      error: NextResponse.json(
        { error: "Bu işlem yalnızca admin yetkisiyle yapılabilir." },
        { status: 403 },
      ),
    };
  }
  return { session };
}

export async function GET() {
  try {
    const auth = await requireAdminSession();
    if (auth.error) return auth.error;

    const rows = await prisma.landingContactRequest.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    return NextResponse.json({
      success: true,
      requests: rows.map((r) => ({
        id: r.id,
        fullName: r.fullName,
        email: r.email,
        phone: r.phone,
        message: r.message,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    console.error("Admin landing contacts:", e);
    return NextResponse.json(
      { error: "Sunucu hatası oluştu." },
      { status: 500 },
    );
  }
}
