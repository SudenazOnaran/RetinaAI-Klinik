"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentDoctorSession } from "@/lib/auth-session";

export async function updatePatientRisk(patientId: string, risk: string) {
  const doctor = await getCurrentDoctorSession();
  if (!doctor) {
    throw new Error("Oturum bulunamadı");
  }

  const updated = await prisma.patient.updateMany({
    where: { id: patientId, doctorId: doctor.id },
    data: { risk },
  });

  if (updated.count === 0) {
    throw new Error("Hasta kaydı bulunamadı veya yetkiniz yok");
  }
}
