"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentDoctorSession } from "@/lib/auth-session";
import { revalidatePath } from "next/cache";

export async function bulkDeletePatientsAction(patientIds: string[]) {
  const doctor = await getCurrentDoctorSession();
  if (!doctor) {
    return { success: false, error: "Oturum bulunamadi." };
  }

  const normalizedIds = Array.from(new Set(patientIds.filter(Boolean)));
  if (normalizedIds.length === 0) {
    return { success: false, error: "Hasta secimi gerekli." };
  }

  const deleted = await prisma.patient.deleteMany({
    where: {
      doctorId: doctor.id,
      id: { in: normalizedIds },
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/hastalar");

  return {
    success: true,
    deletedCount: deleted.count,
  };
}
