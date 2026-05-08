import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileDoctorSession } from "@/lib/auth-session";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  const session = getMobileDoctorSession(req);
  if (!session) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const { id } = await params;
  const analysis = await prisma.analysis.findFirst({
    where: { id, patient: { doctorId: session.id } },
    include: { patient: { select: { doctorId: true } } },
  });

  if (!analysis) {
    return NextResponse.json({ error: "Analiz bulunamadı" }, { status: 404 });
  }

  return NextResponse.json({ analysis });
}

export async function PATCH(req: Request, { params }: Params) {
  const session = getMobileDoctorSession(req);
  if (!session) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await prisma.analysis.findFirst({
    where: { id, patient: { doctorId: session.id } },
  });

  if (!existing) {
    return NextResponse.json({ error: "Analiz bulunamadı" }, { status: 404 });
  }

  const body = await req.json();
  const allowedFields = ["doctorNote", "isCorrect", "actualResult", "drFeedback"];
  const updateData = Object.fromEntries(
    Object.entries(body as Record<string, unknown>).filter(([k]) => allowedFields.includes(k)),
  );

  const analysis = await prisma.analysis.update({ where: { id }, data: updateData });
  return NextResponse.json({ analysis });
}

export async function DELETE(req: Request, { params }: Params) {
  const session = getMobileDoctorSession(req);
  if (!session) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await prisma.analysis.findFirst({
    where: { id, patient: { doctorId: session.id } },
  });

  if (!existing) {
    return NextResponse.json({ error: "Analiz bulunamadı" }, { status: 404 });
  }

  await prisma.analysis.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
