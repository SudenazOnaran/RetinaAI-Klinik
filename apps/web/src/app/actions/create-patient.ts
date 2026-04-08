"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getCurrentDoctorSession } from "@/lib/auth-session";
import { logAuditEvent } from "@/lib/audit-log";
import { validateCreatePatientInput } from "@/lib/patient-validation";

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

    const parsed = validateCreatePatientInput(formData);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Gecersiz hasta verisi.",
      };
    }

    const normalized = parsed.data;

    const existing = await prisma.patient.findFirst({
      where: {
        doctorId: doctor.id,
        tcNo: normalized.tcNo,
      },
      select: { id: true },
    });

    if (existing) {
      return {
        success: false,
        error: "Bu TC No ile kayitli hasta zaten mevcut.",
      };
    }

    const patient = await prisma.patient.create({
      data: {
        doctorId: doctor.id,
        fullName: normalized.fullName,
        tcNo: normalized.tcNo,
        age: normalized.age,
        gender: normalized.gender,
        diabetesYears: normalized.diabetesYears ?? null,
        hba1c: normalized.hba1c ?? null,
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
        patientId: patient.id,
        tcNoMasked: `*******${normalized.tcNo.slice(-4)}`,
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
