import { NextResponse } from "next/server";
import { getCurrentDoctorSession } from "@/lib/auth-session";
import { isRoleAllowed } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { appendKvkkProcessingLog } from "@/lib/kvkk";
import { logAuditEvent } from "@/lib/audit-log";

export async function POST(req: Request) {
  const session = await getCurrentDoctorSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum bulunamadi" }, { status: 401 });
  }

  if (!isRoleAllowed(session.role, ["DOCTOR", "MANAGER"])) {
    return NextResponse.json({ error: "Yetkiniz yok" }, { status: 403 });
  }

  const body = (await req.json()) as { patientId?: string };

  if (!body.patientId) {
    return NextResponse.json({ error: "patientId gerekli" }, { status: 400 });
  }

  const patient = await prisma.patient.findFirst({
    where: { id: body.patientId, doctorId: session.id },
    select: { id: true, fullName: true },
  });

  if (!patient) {
    return NextResponse.json({ error: "Hasta bulunamadi" }, { status: 404 });
  }

  const anonymizedName = `Anonim Hasta ${patient.id.slice(-6).toUpperCase()}`;
  const anonymizedTc = `ANON-${patient.id.slice(0, 8).toUpperCase()}`;

  await prisma.$transaction([
    prisma.analysis.updateMany({
      where: { patientId: patient.id },
      data: {
        doctorNote: null,
        ilaclar: null,
        originalImage: null,
        heatmapUrl: null,
      },
    }),
    prisma.patient.update({
      where: { id: patient.id },
      data: {
        fullName: anonymizedName,
        tcNo: anonymizedTc,
        gender: null,
        diabetesYears: null,
        hba1c: null,
      },
    }),
  ]);

  await appendKvkkProcessingLog({
    doctorId: session.id,
    patientId: patient.id,
    action: "ANONYMIZE",
    detail: "Hasta verisi KVKK kapsaminda anonimlestirildi",
    metadata: {
      oldName: patient.fullName,
      newName: anonymizedName,
    },
  });

  await logAuditEvent({
    doctorId: session.id,
    role: session.role,
    action: "EDIT",
    entityType: "PATIENT",
    entityId: patient.id,
    description: "KVKK anonymizasyon islemi uygulandi",
  });

  return NextResponse.json({
    success: true,
    patientId: patient.id,
    fullName: anonymizedName,
    tcNo: anonymizedTc,
  });
}
