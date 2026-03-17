"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentDoctorSession } from "@/lib/auth-session";

export async function getAnalysisReports() {
  try {
    const doctor = await getCurrentDoctorSession();
    if (!doctor) {
      return { success: false, error: "Oturum bulunamadı." };
    }

    const reports = await prisma.analysis.findMany({
      where: {
        patient: {
          doctorId: doctor.id,
        },
      },
      include: {
        patient: {
          select: {
            fullName: true,
            tcNo: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc", // En yeni analiz en üstte
      },
    });
    return { success: true, data: reports };
  } catch (error) {
    return { success: false, error: "Raporlar yüklenemedi." };
  }
}
