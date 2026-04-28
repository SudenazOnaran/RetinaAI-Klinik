"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentDoctorSession } from "@/lib/auth-session";
import { revalidatePath } from "next/cache";
import {
  computeDiseaseTriageFromAnalysisFields,
  serializePatientDiseaseTriageForDb,
} from "@/lib/patient-disease-triage";

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

  const triage = computeDiseaseTriageFromAnalysisFields({
    drFeedback: risk.trim(),
  });
  const storedRisk = serializePatientDiseaseTriageForDb(triage);

  const updated = await prisma.patient.updateMany({
    where: {
      doctorId: doctor.id,
      id: { in: normalizedIds },
    },
    data: {
      risk: storedRisk,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/hastalar");

  return {
    success: true,
    updatedCount: updated.count,
  };
}
