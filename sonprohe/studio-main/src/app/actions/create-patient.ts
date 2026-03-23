"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getCurrentDoctorSession } from "@/lib/auth-session";
import { logAuditEvent } from "@/lib/audit-log";

export async function createPatientAction(formData: {
  fullName: string;
  tcNo: string;
  age: number;
  gender: string;
  diabetesYears?: number | null;
  hba1c?: number | null;
}) {
  try {
    const doctor = await getCurrentDoctorSession();
    if (!doctor) {
      return { success: false, error: "Oturum bulunamadı." };
    }

    const patient = await prisma.patient.create({
      data: {
        doctorId: doctor.id,
        fullName: formData.fullName,
        tcNo: formData.tcNo,
        age: formData.age,
        gender: formData.gender,
        diabetesYears: formData.diabetesYears,
        hba1c: formData.hba1c,
        risk: "Yok", // Şemandaki default değer
      },
    });

    await logAuditEvent({
      doctorId: doctor.id,
      role: doctor.role,
      action: "CREATE",
      entityType: "PATIENT",
      entityId: patient.id,
      description: "Yeni hasta kaydi olusturuldu",
      metadata: {
        fullName: formData.fullName,
        tcNo: formData.tcNo,
      },
    });

    revalidatePath("/dashboard/hastalar");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error: any) {
    console.error("Kayıt Hatası:", error);
    return { success: false, error: "Hasta kaydedilemedi." };
  }
}
