import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileDoctorSession } from "@/lib/auth-session";

export async function GET(req: Request) {
  const session = getMobileDoctorSession(req);
  if (!session) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const patientId = searchParams.get("patientId");

  if (!patientId) {
    return NextResponse.json({ error: "patientId parametresi zorunlu" }, { status: 400 });
  }

  // Hastanın bu doktora ait olduğunu doğrula
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, doctorId: session.id },
  });

  if (!patient) {
    return NextResponse.json({ error: "Hasta bulunamadı" }, { status: 404 });
  }

  const analyses = await prisma.analysis.findMany({
    where: { patientId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ analyses });
}

export async function POST(req: Request) {
  const session = getMobileDoctorSession(req);
  if (!session) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const body = await req.json() as Record<string, unknown>;
  const { patientId, aiResult, confidence, heatmapUrl, originalImageUrl, doctorNote } = body;

  if (!patientId || !aiResult || confidence === undefined) {
    return NextResponse.json(
      { error: "Eksik alan: patientId, aiResult, confidence zorunlu" },
      { status: 400 },
    );
  }

  // Hastanın bu doktora ait olduğunu doğrula
  const patient = await prisma.patient.findFirst({
    where: { id: String(patientId), doctorId: session.id },
  });

  if (!patient) {
    return NextResponse.json({ error: "Hasta bulunamadı" }, { status: 404 });
  }

  const analysis = await prisma.analysis.create({
    data: {
      patientId: String(patientId),
      aiResult: String(aiResult),
      confidence: Number(confidence),
      heatmapUrl: heatmapUrl ? String(heatmapUrl) : null,
      originalImage: originalImageUrl ? String(originalImageUrl) : null,
      doctorNote: doctorNote ? String(doctorNote) : null,
    },
  });

  return NextResponse.json({ analysis }, { status: 201 });
}
