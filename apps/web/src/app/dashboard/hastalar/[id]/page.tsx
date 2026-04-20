import { Suspense } from "react";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { getCurrentDoctorSession } from "@/lib/auth-session";
import { logAuditEvent } from "@/lib/audit-log";
import {
  formatErrorCause,
  logStructuredError,
} from "@/lib/structured-error-log";
import PatientDetailClient from "./patient-detail-client"; // Dosya yolunu kontrol et

export default async function HastaDetayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const doctor = await getCurrentDoctorSession();

  if (!doctor) notFound();

  if (!id) notFound();

  let patient;
  try {
    patient = await prisma.patient.findFirst({
      where: { id: id, doctorId: doctor.id },
      include: {
        doctor: {
          select: {
            name: true,
          },
        },
        analyses: {
          orderBy: { createdAt: "desc" },
        },
      },
    });
  } catch (error) {
    const hdrs = await headers();
    const requestId = hdrs.get("x-request-id")?.trim() || "unknown";
    logStructuredError({
      requestId,
      route: "/dashboard/hastalar/[id]",
      action: "PATIENT_DETAIL_FETCH",
      patientId: id,
      errorMessage:
        error instanceof Error ? error.message : "Hasta verisi okunamadi",
      stack: error instanceof Error ? error.stack : undefined,
      cause: formatErrorCause(error),
    });
    throw error;
  }

  if (!patient) notFound();

  await logAuditEvent({
    doctorId: doctor.id,
    role: doctor.role,
    action: "VIEW",
    entityType: "PATIENT",
    entityId: patient.id,
    description: "Hasta detay sayfasi goruntulendi",
  });

  return (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-slate-600">Yükleniyor…</div>
      }
    >
      <PatientDetailClient patient={patient} />
    </Suspense>
  );
}
