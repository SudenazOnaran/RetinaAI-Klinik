import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentDoctorSession } from "@/lib/auth-session";

export async function GET() {
  const session = await getCurrentDoctorSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum bulunamadı" }, { status: 401 });
  }

  const doctor = await prisma.doctor.findUnique({
    where: { id: session.id },
    select: { id: true, name: true, email: true },
  });

  if (!doctor) {
    return NextResponse.json({ error: "Doktor bulunamadı" }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    doctor,
  });
}

export async function PUT(req: Request) {
  const session = await getCurrentDoctorSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum bulunamadı" }, { status: 401 });
  }

  const body = (await req.json()) as { fullName?: string };
  const fullName = body.fullName?.trim();

  if (!fullName) {
    return NextResponse.json(
      { error: "Doktor adı boş olamaz" },
      { status: 400 },
    );
  }

  const updated = await prisma.doctor.update({
    where: { id: session.id },
    data: { name: fullName },
    select: { id: true, name: true, email: true },
  });

  return NextResponse.json({ success: true, doctor: updated });
}
