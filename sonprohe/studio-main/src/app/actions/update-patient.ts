"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getCurrentDoctorSession } from "@/lib/auth-session";

export async function updatePatientAction(formData: FormData) {
  const doctor = await getCurrentDoctorSession();
  if (!doctor) {
    throw new Error("Oturum bulunamadı");
  }

  const id = formData.get("id") as string;

  const diabetesYearsRaw = formData.get("diabetesYears");
  const hba1cRaw = formData.get("hba1c");

  const updated = await prisma.patient.updateMany({
    where: { id, doctorId: doctor.id },
    data: {
      age: Number(formData.get("age")),

      diabetesYears: diabetesYearsRaw === "" ? null : Number(diabetesYearsRaw),

      hba1c: hba1cRaw === "" ? null : Number(hba1cRaw),
    },
  });

  if (updated.count === 0) {
    throw new Error("Hasta kaydı bulunamadı veya yetkiniz yok");
  }

  revalidatePath("/dashboard/hastalar");
  revalidatePath(`/dashboard/hastalar/${id}`);
}
