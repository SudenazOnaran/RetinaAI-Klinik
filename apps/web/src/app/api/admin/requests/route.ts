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

export async function GET(req: Request) {
  try {
    const auth = await requireAdminSession();
    if (auth.error) return auth.error;

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "ALL";

    let whereClause = "";
    if (status === "PENDING") {
      whereClause = `WHERE "approvalStatus" = 'PENDING'`;
    } else if (status === "APPROVED") {
      whereClause = `WHERE "approvalStatus" = 'APPROVED'`;
    } else if (status === "REJECTED") {
      whereClause = `WHERE "approvalStatus" = 'REJECTED'`;
    }

    const doctors = await prisma.$queryRawUnsafe<
      Array<{
        id: string;
        name: string;
        surname: string;
        email: string;
        specialty: string;
        hospital: string;
        role: string;
        approvalStatus: string;
        isActive: boolean;
        createdAt: Date;
      }>
    >(
      `SELECT "id", "name", "surname", "email", "specialty", "hospital",
              "role", "approvalStatus", "isActive", "createdAt"
       FROM "Doctor"
       ${whereClause}
       ORDER BY "createdAt" DESC`,
    );

    return NextResponse.json({ success: true, doctors });
  } catch (e) {
    console.error("Admin istek listeleme hatası:", e);
    return NextResponse.json(
      { error: "Sunucu hatası oluştu." },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await requireAdminSession();
    if (auth.error) return auth.error;

    const { doctorId, action } = await req.json();

    if (!doctorId || !action) {
      return NextResponse.json(
        { error: "doctorId ve action alanları zorunludur." },
        { status: 400 },
      );
    }

    if (action !== "APPROVE" && action !== "REJECT") {
      return NextResponse.json(
        { error: "Geçersiz işlem. APPROVE veya REJECT olmalıdır." },
        { status: 400 },
      );
    }

    const rows = await prisma.$queryRaw<
      Array<{ id: string; approvalStatus: string }>
    >`
      SELECT "id", "approvalStatus"
      FROM "Doctor"
      WHERE "id" = ${doctorId}
      LIMIT 1
    `;

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Doktor bulunamadı." },
        { status: 404 },
      );
    }

    if (action === "APPROVE") {
      await prisma.$executeRaw`
        UPDATE "Doctor"
        SET "approvalStatus" = 'APPROVED'::"ApprovalStatus",
            "isActive" = true
        WHERE "id" = ${doctorId}
      `;
    } else {
      await prisma.$executeRaw`
        UPDATE "Doctor"
        SET "approvalStatus" = 'REJECTED'::"ApprovalStatus",
            "isActive" = false
        WHERE "id" = ${doctorId}
      `;
    }

    const updated = await prisma.$queryRaw<
      Array<{
        id: string;
        name: string;
        surname: string;
        email: string;
        approvalStatus: string;
        isActive: boolean;
      }>
    >`
      SELECT "id", "name", "surname", "email", "approvalStatus", "isActive"
      FROM "Doctor"
      WHERE "id" = ${doctorId}
      LIMIT 1
    `;

    return NextResponse.json({
      success: true,
      doctor: updated[0],
      message:
        action === "APPROVE"
          ? "Doktor başvurusu onaylandı."
          : "Doktor başvurusu reddedildi.",
    });
  } catch (e) {
    console.error("Admin onay/red hatası:", e);
    return NextResponse.json(
      { error: "Sunucu hatası oluştu." },
      { status: 500 },
    );
  }
}
