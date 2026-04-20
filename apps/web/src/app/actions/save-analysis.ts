"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getCurrentDoctorSession } from "@/lib/auth-session";
import { logAuditEvent } from "@/lib/audit-log";
import { saveDataObject } from "@/lib/object-storage";
import {
  formatErrorCause,
  logStructuredError,
  summarizeSaveAnalysisPayload,
} from "@/lib/structured-error-log";

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
  const MAX_FIELD_LENGTH = 1500;
  const getExceededReportField = (rawDoctorNote: string) => {
    if (!rawDoctorNote) return null;

    let parsed: {
      sections?: {
        anamnesis?: string;
        examFindings?: string;
        labResults?: string;
        clinicalAssessment?: string;
      };
      doctorNotes?: string;
    } | null = null;

    try {
      parsed = JSON.parse(rawDoctorNote) as {
        sections?: {
          anamnesis?: string;
          examFindings?: string;
          labResults?: string;
          clinicalAssessment?: string;
        };
        doctorNotes?: string;
      };
    } catch {
      return null;
    }

    return [
      {
        label: "Klinik Öykü (Anamnez)",
        value: String(parsed?.sections?.anamnesis || ""),
      },
      {
        label: "Muayene Bulguları",
        value: String(parsed?.sections?.examFindings || ""),
      },
      {
        label: "Laboratuvar Sonuçları",
        value: String(parsed?.sections?.labResults || ""),
      },
      {
        label: "Teşhis / Klinik Değerlendirme",
        value: String(parsed?.sections?.clinicalAssessment || ""),
      },
      {
        label: "Doktor Notları",
        value: String(parsed?.doctorNotes || ""),
      },
    ].find((field) => field.value.length > MAX_FIELD_LENGTH);
  };

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
    const rawIlaclar = String(ilaclar || "");
    const sanitizedIlaclar = rawIlaclar.trim();
    if (rawIlaclar.length > MAX_FIELD_LENGTH) {
      return {
        ok: false as const,
        error: `Tedavi ve Öneriler alanında maksimum karakter sınırı aşıldı (${rawIlaclar.length}/${MAX_FIELD_LENGTH}).`,
      };
    }

    const rawDoctorNote = String(doctorNote || "");
    const exceededField = getExceededReportField(rawDoctorNote);
    if (exceededField) {
      return {
        ok: false as const,
        error: `${exceededField.label} alanında maksimum karakter sınırı aşıldı (${exceededField.value.length}/${MAX_FIELD_LENGTH}).`,
      };
    }

    const doctor = await getCurrentDoctorSession();
    if (!doctor) {
      return { ok: false as const, error: "Oturum bulunamadı" };
    }

    const patient = await prisma.patient.findFirst({
      where: { id: patientId, doctorId: doctor.id },
      select: { id: true },
    });

    if (!patient) {
      return { ok: false as const, error: "Bu hasta için işlem yetkiniz yok" };
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
        ilaclar: sanitizedIlaclar || undefined,
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
      ok: true as const,
      analysisId: savedAnalysis.id,
      createdAt: savedAnalysis.createdAt.toISOString(),
      finalRiskStatus,
      confidence,
    };
  } catch (error) {
    const hdrs = await headers();
    const requestId = hdrs.get("x-request-id")?.trim() || "unknown";
    const message = error instanceof Error ? error.message : "";
    logStructuredError({
      requestId,
      route: "saveAnalysisAction",
      action: "SAVE_REPORT",
      patientId,
      errorMessage: message || "Kayit hatasi",
      stack: error instanceof Error ? error.stack : undefined,
      cause: formatErrorCause(error),
      payloadSummary: summarizeSaveAnalysisPayload({
        doctorNoteLen: String(doctorNote || "").length,
        ilaclarLen: String(ilaclar || "").length,
        hasHeatmap: Boolean(heatmapUrl),
        hasOriginalImage: Boolean(originalImage),
        aiResultLen: String(aiResult || "").length,
        labelsCount: Array.isArray(aiOdriLabels) ? aiOdriLabels.length : 0,
      }),
    });
    const looksLikeColumnLengthError =
      /P2000|too long|value for the column is too long|character varying/i.test(
        message,
      );
    if (looksLikeColumnLengthError) {
      const exceededFieldAfterCatch = getExceededReportField(
        String(doctorNote || ""),
      );
      if (exceededFieldAfterCatch) {
        return {
          ok: false as const,
          error: `${exceededFieldAfterCatch.label} alanında maksimum karakter sınırı aşıldı (${exceededFieldAfterCatch.value.length}/${MAX_FIELD_LENGTH}).`,
        };
      }
      if (String(ilaclar || "").length > MAX_FIELD_LENGTH) {
        return {
          ok: false as const,
          error: `Tedavi ve Öneriler alanında maksimum karakter sınırı aşıldı (${String(ilaclar || "").length}/${MAX_FIELD_LENGTH}).`,
        };
      }
      return {
        ok: false as const,
        error:
          "Veritabanı alan uzunluğu güncel değil. Lütfen migration çalıştırın ve tekrar deneyin.",
      };
    }
    return {
      ok: false as const,
      error: message || "Kayıt sırasında beklenmeyen bir hata oluştu.",
    };
  }
}
