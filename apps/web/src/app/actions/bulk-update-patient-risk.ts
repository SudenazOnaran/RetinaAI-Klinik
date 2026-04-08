"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentDoctorSession } from "@/lib/auth-session";
import { revalidatePath } from "next/cache";

export async function bulkUpdatePatientRiskAction(
  patientIds: string[],
  risk: string,
) {
  const doctor = await getCurrentDoctorSession();
  if (!doctor) {
    return { success: false, error: "Oturum bulunamadi." };
  }

  const normalizedIds = Array.from(new Set(patientIds.filter(Boolean)));
  if (normalizedIds.length === 0) {
    return { success: false, error: "Hasta secimi gerekli." };
  }

  if (!risk || !risk.trim()) {
    return { success: false, error: "Risk degeri gerekli." };
  }

  const updated = await prisma.patient.updateMany({
    where: {
      doctorId: doctor.id,
      id: { in: normalizedIds },
    },
    data: {
      risk: risk.trim(),
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/hastalar");

  return {
    success: true,
    updatedCount: updated.count,
  };
}
