"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentDoctorSession } from "@/lib/auth-session";
import { logAuditEvent } from "@/lib/audit-log";
import { saveDataObject } from "@/lib/object-storage";

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
    const storedOriginalImage = originalImage
      ? await saveDataObject({
          doctorId: doctor.id,
          patientId,
          category: "original",
          dataUrlOrBase64: originalImage,
        })
      : null;

    const storedHeatmapImage = heatmapUrl
      ? await saveDataObject({
          doctorId: doctor.id,
          patientId,
          category: "heatmap",
          dataUrlOrBase64: heatmapUrl,
        })
      : null;

    const savedAnalysis = await prisma.analysis.create({
      data: {
        patientId,
        aiResult, // AI'nın bulduğu ham sonuç
        confidence,
        heatmapUrl: storedHeatmapImage?.url,
        originalImage: storedOriginalImage?.url,
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

    await logAuditEvent({
      doctorId: doctor.id,
      role: doctor.role,
      action: sanitizedFeedback ? "APPROVE" : "EDIT",
      entityType: "ANALYSIS",
      entityId: savedAnalysis.id,
      description: sanitizedFeedback
        ? "Doktor geri bildirimi ile analiz onayi kaydedildi"
        : "Yeni analiz kaydi olusturuldu",
      metadata: {
        patientId,
        finalRiskStatus,
        aiResult,
        confidence,
        objectStorage: {
          original: storedOriginalImage?.url ?? null,
          heatmap: storedHeatmapImage?.url ?? null,
        },
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
