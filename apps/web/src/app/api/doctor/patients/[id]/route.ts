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
  const patient = await prisma.patient.findFirst({
    where: { id, doctorId: session.id },
  });

  if (!patient) {
    return NextResponse.json({ error: "Hasta bulunamadı" }, { status: 404 });
  }

  return NextResponse.json({ patient });
}

export async function PATCH(req: Request, { params }: Params) {
  const session = getMobileDoctorSession(req);
  if (!session) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await prisma.patient.findFirst({
    where: { id, doctorId: session.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Hasta bulunamadı" }, { status: 404 });
  }

  const body = await req.json();
  const allowedFields = ["fullName", "tcNo", "age", "risk", "diabetesYears", "gender", "hba1c"];
  const updateData = Object.fromEntries(
    Object.entries(body as Record<string, unknown>).filter(([k]) => allowedFields.includes(k)),
  );

  const patient = await prisma.patient.update({ where: { id }, data: updateData });
  return NextResponse.json({ patient });
}

export async function DELETE(req: Request, { params }: Params) {
  const session = getMobileDoctorSession(req);
  if (!session) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await prisma.patient.findFirst({
    where: { id, doctorId: session.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Hasta bulunamadı" }, { status: 404 });
  }

  await prisma.patient.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
