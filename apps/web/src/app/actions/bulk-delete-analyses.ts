"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentDoctorSession } from "@/lib/auth-session";
import { revalidatePath } from "next/cache";

export async function bulkDeleteAnalysesAction(analysisIds: string[]) {
  const doctor = await getCurrentDoctorSession();
  if (!doctor) {
    return { success: false, error: "Oturum bulunamadi." };
  }

  const normalizedIds = Array.from(new Set(analysisIds.filter(Boolean)));
  if (normalizedIds.length === 0) {
    return { success: false, error: "Rapor secimi gerekli." };
  }

  const deleted = await prisma.analysis.deleteMany({
    where: {
      id: { in: normalizedIds },
      patient: {
        doctorId: doctor.id,
      },
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/hastalar");
  revalidatePath("/dashboard/raporlar");

  return {
    success: true,
    deletedCount: deleted.count,
  };
}
