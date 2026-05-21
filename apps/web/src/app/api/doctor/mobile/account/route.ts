import { NextResponse } from "next/server";
import { getMobileDoctorSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { isRoleAllowed, type DoctorRole } from "@/lib/roles";

const SELF_DELETE_ROLES: readonly DoctorRole[] = [
  "DOCTOR",
  "MANAGER",
  "ASSISTANT",
  "AUDITOR",
  "ADMIN",
];

/**
 * Mobil oturumla doktor hesabını ve ilişkili klinik verilerini kalıcı olarak siler.
 * Google Play hesap silme gereksinimi için uygulama içi endpoint.
 */
export async function DELETE(req: Request) {
  const session = getMobileDoctorSession(req);
  if (!session) {
    return NextResponse.json({ error: "Oturum bulunamadı" }, { status: 401 });
  }

  if (!isRoleAllowed(session.role, SELF_DELETE_ROLES)) {
    return NextResponse.json({ error: "Yetkiniz yok" }, { status: 403 });
  }

  const doctorId = session.id;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.monitoringAlert.deleteMany({ where: { doctorId } });
      await tx.pilotMetricSnapshot.deleteMany({ where: { doctorId } });
      await tx.pilotMetricEvent.deleteMany({ where: { doctorId } });
      await tx.aiRequestQueue.deleteMany({ where: { doctorId } });
      await tx.integrationEvent.deleteMany({ where: { doctorId } });
      await tx.kvkkProcessingLog.deleteMany({ where: { doctorId } });
      await tx.kvkkConsent.deleteMany({ where: { doctorId } });
      await tx.auditLog.deleteMany({ where: { doctorId } });
      await tx.doctor.delete({ where: { id: doctorId } });
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("doctor mobile account delete failed", e);
    return NextResponse.json(
      { error: "Hesap silinirken bir hata oluştu" },
      { status: 500 },
    );
  }
}
