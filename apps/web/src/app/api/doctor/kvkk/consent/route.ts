import { NextResponse } from "next/server";
import { getCurrentDoctorSession } from "@/lib/auth-session";
import { isRoleAllowed } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import {
  upsertKvkkConsent,
  getKvkkConsents,
  appendKvkkProcessingLog,
} from "@/lib/kvkk";
import { logAuditEvent } from "@/lib/audit-log";

export async function GET() {
  const session = await getCurrentDoctorSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum bulunamadı" }, { status: 401 });
  }

  if (!isRoleAllowed(session.role, ["DOCTOR", "MANAGER", "AUDITOR"])) {
    return NextResponse.json({ error: "Yetkiniz yok" }, { status: 403 });
  }

  const [patients, consents] = await Promise.all([
    prisma.patient.findMany({
      where: { doctorId: session.id },
      select: {
        id: true,
        fullName: true,
        tcNo: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    getKvkkConsents(session.id),
  ]);

  const consentMap = new Map(consents.map((row) => [row.patientId, row]));

  return NextResponse.json({
    success: true,
    rows: patients.map((patient) => {
      const consent = consentMap.get(patient.id);
      return {
        patient,
        consent: consent
          ? {
              consentGiven: consent.consentGiven,
              consentVersion: consent.consentVersion,
              consentAt: consent.consentAt?.toISOString() ?? null,
              note: consent.note,
              updatedAt: consent.updatedAt.toISOString(),
            }
          : null,
      };
    }),
  });
}

export async function PUT(req: Request) {
  const session = await getCurrentDoctorSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum bulunamadı" }, { status: 401 });
  }

  if (!isRoleAllowed(session.role, ["DOCTOR", "MANAGER"])) {
    return NextResponse.json({ error: "Yetkiniz yok" }, { status: 403 });
  }

  const body = (await req.json()) as {
    patientId?: string;
    consentGiven?: boolean;
    consentVersion?: string;
    note?: string;
  };

  if (!body.patientId || typeof body.consentGiven !== "boolean") {
    return NextResponse.json({ error: "Eksik alan" }, { status: 400 });
  }

  const patient = await prisma.patient.findFirst({
    where: { id: body.patientId, doctorId: session.id },
    select: { id: true, fullName: true },
  });

  if (!patient) {
    return NextResponse.json({ error: "Hasta bulunamadı" }, { status: 404 });
  }

  const saved = await upsertKvkkConsent({
    doctorId: session.id,
    patientId: patient.id,
    consentGiven: body.consentGiven,
    consentVersion: body.consentVersion || "v1",
    note: body.note,
  });

  await appendKvkkProcessingLog({
    doctorId: session.id,
    patientId: patient.id,
    action: "CONSENT_UPDATE",
    detail: `Açık rıza durumu güncellendi (${body.consentGiven ? "onaylı" : "reddedildi"})`,
    metadata: {
      patientName: patient.fullName,
      consentVersion: body.consentVersion || "v1",
    },
  });

  await logAuditEvent({
    doctorId: session.id,
    role: session.role,
    action: "EDIT",
    entityType: "SYSTEM",
    entityId: patient.id,
    description: "KVKK açık rıza durumu güncellendi",
    metadata: {
      patientName: patient.fullName,
      consentGiven: body.consentGiven,
    },
  });

  return NextResponse.json({
    success: true,
    consent: {
      patientId: saved.patientId,
      consentGiven: saved.consentGiven,
      consentVersion: saved.consentVersion,
      consentAt: saved.consentAt?.toISOString() ?? null,
      note: saved.note,
      updatedAt: saved.updatedAt.toISOString(),
    },
  });
}
