"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentDoctorSession } from "@/lib/auth-session";

export async function saveAnalysisAction({
  patientId,
  aiResult,
  confidence,
  heatmapUrl,
  originalImage,
  doctorNote,
  ilaclar,
  aiOdriLabels,
  aiOdriConfidences,
  drFeedback,
}: {
  patientId: string;
  aiResult: string;
  confidence: number;
  heatmapUrl?: string;
  originalImage?: string;
  doctorNote?: string;
  ilaclar?: string;
  aiOdriLabels?: string[];
  aiOdriConfidences?: number[];
  drFeedback?: string; // Bu değer varsa DOKTOR DÜZELTMİŞTİR, yoksa AI DOĞRUDUR.
}) {
  try {
    const normalize = (value: string) =>
      value.trim().toLowerCase().replace(/\s+/g, "_");
    const validDrLabels = new Set([
      "no_dr",
      "mild",
      "moderate",
      "severe",
      "proliferative_dr",
    ]);
    const sanitizedFeedback =
      drFeedback && validDrLabels.has(normalize(drFeedback))
        ? drFeedback
        : undefined;

    const doctor = await getCurrentDoctorSession();
    if (!doctor) {
      throw new Error("Oturum bulunamadı");
    }

    const patient = await prisma.patient.findFirst({
      where: { id: patientId, doctorId: doctor.id },
      select: { id: true },
    });

    if (!patient) {
      throw new Error("Bu hasta için işlem yetkiniz yok");
    }

    // 🔹 1. Analysis tablosuna kaydet
    const savedAnalysis = await prisma.analysis.create({
      data: {
        patientId,
        aiResult, // AI'nın bulduğu ham sonuç
        confidence,
        heatmapUrl,
        originalImage,
        doctorNote,
        ilaclar,
        aiOdriLabels: aiOdriLabels ? JSON.stringify(aiOdriLabels) : null,
        aiOdriConfidences: aiOdriConfidences
          ? JSON.stringify(aiOdriConfidences)
          : null,
        drFeedback: sanitizedFeedback, // Doktorun düzeltmesi (varsa)
      },
      select: {
        id: true,
        createdAt: true,
      },
    });

    // 🔹 2. Hasta Risk Durumunu Belirle (MANTIK BURADA DÜZELTİLDİ)
    // Eğer drFeedback doluysa (Doktor "Yanlış" deyip düzeltmişse) -> Doktorun dediğini al.
    // Eğer drFeedback boşsa (Doktor "Evet Doğru" dediyse) -> AI sonucunu (aiResult) al.
    const finalRiskStatus = sanitizedFeedback ? sanitizedFeedback : aiResult;

    // 🔹 3. Patient Tablosunu Güncelle
    await prisma.patient.update({
      where: { id: patientId },
      data: {
        risk: finalRiskStatus, // Artık hasta listesinde bu görünecek
      },
    });

    return {
      analysisId: savedAnalysis.id,
      createdAt: savedAnalysis.createdAt.toISOString(),
      finalRiskStatus,
      confidence,
    };
  } catch (error) {
    console.error("Error saving analysis:", error);
    throw error;
  }
}
