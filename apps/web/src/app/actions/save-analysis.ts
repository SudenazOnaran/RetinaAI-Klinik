"use server";

import { headers } from "next/headers";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentDoctorSession } from "@/lib/auth-session";
import { logAuditEvent } from "@/lib/audit-log";
import { saveDataObject } from "@/lib/object-storage";
import {
  formatErrorCause,
  logStructuredError,
  summarizeSaveAnalysisPayload,
} from "@/lib/structured-error-log";
import { getRequestLocale } from "@/lib/i18n/server";
import { resolveDrLabelToStoredForm } from "@/lib/dr-stage-labels";
import {
  isDoctorApprovalToken,
  isModalityDisagreePending,
} from "@/lib/doctor-feedback";
import {
  tryParseFfaDoctorFeedbackAny,
} from "@/lib/ffa-doctor-feedback-json";
import {
  DATASET_SCHEMA_VERSION,
  parseClientInferenceSnapshot,
  parseDoctorStructuredReviewForStorage,
  sanitizePhysicianClinicalReasoning,
  uncertaintyScoreFromSnapshot,
  type AiInferenceSnapshot,
} from "@/lib/dataset/snapshot";
import {
  computeTrainingLabelQuality,
  resolveGoldDrGradeInt,
} from "@/lib/dataset/training-labels";
import { buildTrainingInferenceSnapshotV2 } from "@/lib/dataset/training-snapshot-v2";
import {
  buildCombinedDoctorNotesText,
  computeTrainingDatasetEntryFeatureColumns,
} from "@/lib/dataset/training-entry-features";
import {
  buildManualReportV2DoctorNoteJson,
  getFirstExceededReportSection,
  ILACLAR_COLUMN_MAX_LEN,
  parseComorbidityJsonForStorage,
  REPORT_SECTION_MAX_LEN,
  type AnalysisReportMetaInput,
  type AnalysisReportSectionsInput,
} from "@/lib/dataset/analysis-report-sections";
import {
  computeDiseaseTriageFromAnalysisFields,
  serializePatientDiseaseTriageForDb,
} from "@/lib/patient-disease-triage";
import {
  FFA_DISEASE_KEYS,
  FFA_HEALTHY_VALUE,
} from "@/lib/modality-risk-surface";

const MODALITY_DR_FEEDBACK_MAX = 4000;
/** OCT/FFAda hastalık adı; serbest kısa metin (AI satırı dışı). */
const MODALITY_DISEASE_STR_MAX = 512;

function prismaReportKindFromMeta(
  meta: AnalysisReportMetaInput | null | undefined,
): AnalysisReportMetaInput["reportKind"] | undefined {
  return meta?.reportKind;
}

function sanitizeModalityDiseaseFeedbackInput(
  raw: string,
): string | null {
  const x = raw.replace(/\s+/g, " ").trim();
  if (!x) return null;
  if (x.length > MODALITY_DISEASE_STR_MAX) return null;
  return x;
}

const ALLOWED_FFA_FEEDBACK_CODES = new Set<string>(
  FFA_DISEASE_KEYS.map((k) => k.value),
);

/** Prisma $transaction icinde delegate tipleri bazen eslesmez; create imzasi yeterli. */
type PrismaTxTrainingDatasetEntry = {
  trainingDatasetEntry: {
    create: (args: { data: Record<string, unknown> }) => Promise<{ id: string }>;
  };
};

export async function saveAnalysisAction({
  patientId,
  aiResult,
  confidence,
  heatmapUrl,
  originalImage,
  octImage,
  ffaImage,
  doctorNote,
  reportSections,
  reportMeta,
  ilaclar,
  aiOdriLabels,
  aiOdriConfidences,
  drFeedback,
  octDrFeedback,
  ffaDrFeedback,
  aiInferenceSnapshot,
  doctorStructuredReview,
  physicianClinicalReasoning,
  comorbidity,
}: {
  patientId: string;
  aiResult: string;
  confidence: number;
  heatmapUrl?: string;
  originalImage?: string;
  octImage?: string;
  ffaImage?: string;
  /** Geriye dönük: ham JSON string (reportSections yoksa) */
  doctorNote?: string;
  /** Yapılandırılmış rapor; doluysa ayrı sütunlar + doctorNote üretilir */
  reportSections?: AnalysisReportSectionsInput | null;
  reportMeta?: AnalysisReportMetaInput | null;
  ilaclar?: string;
  aiOdriLabels?: string[];
  aiOdriConfidences?: number[];
  drFeedback?: string; // Bu değer varsa DOKTOR DÜZELTMİŞTİR, yoksa AI DOĞRUDUR.
  octDrFeedback?: string;
  ffaDrFeedback?: string;
  /** LLM/yerel /predict yapısal çıktısı (heatmap hariç); veri seti için */
  aiInferenceSnapshot?: AiInferenceSnapshot | null;
  /** Doktor yapısal düzeltmeleri (fundus, DME, karar vb.) */
  doctorStructuredReview?: unknown;
  /** Doktor serbest klinik gerekçe (eğitim hedefi) */
  physicianClinicalReasoning?: string | null;
  /** HT, dislipidemi vb. { conditions: [...] } */
  comorbidity?: unknown;
}) {
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
    ].find((field) => field.value.length > REPORT_SECTION_MAX_LEN);
  };

  try {
    const locale = await getRequestLocale();
    const resolvedAi = resolveDrLabelToStoredForm(aiResult, locale);
    if (!resolvedAi) {
      return {
        ok: false as const,
        error:
          "Geçersiz DR evresi. Lütfen analizi tekrarlayın veya evre seçimini kontrol edin.",
      };
    }

    const rawFeedback = drFeedback?.trim() || "";
    const resolvedFeedback = rawFeedback
      ? resolveDrLabelToStoredForm(rawFeedback, locale)
      : null;
    if (rawFeedback && !resolvedFeedback) {
      return {
        ok: false as const,
        error: "Geçersiz doktor geri bildirimi (DR evresi tanınmadı).",
      };
    }
    const sanitizedFeedback = resolvedFeedback ?? undefined;
    const rawIlaclar = String(ilaclar || "");
    const sanitizedIlaclar = rawIlaclar
      .trim()
      .slice(0, ILACLAR_COLUMN_MAX_LEN);

    const rawOctFb = String(octDrFeedback || "").trim();
    const rawFfaFb = String(ffaDrFeedback || "").trim();
    if (rawOctFb.length > MODALITY_DR_FEEDBACK_MAX) {
      return {
        ok: false as const,
        error: `OCT doktor değerlendirmesi en fazla ${MODALITY_DR_FEEDBACK_MAX} karakter olabilir (${rawOctFb.length}).`,
      };
    }
    if (rawFfaFb.length > MODALITY_DR_FEEDBACK_MAX) {
      return {
        ok: false as const,
        error: `FFA doktor değerlendirmesi en fazla ${MODALITY_DR_FEEDBACK_MAX} karakter olabilir (${rawFfaFb.length}).`,
      };
    }
    let sanitizedOctFb: string | undefined;
    if (rawOctFb && !isModalityDisagreePending(rawOctFb)) {
      if (isDoctorApprovalToken(rawOctFb)) {
        sanitizedOctFb = rawOctFb;
      } else {
        const rDr = resolveDrLabelToStoredForm(rawOctFb, locale);
        if (rDr) {
          sanitizedOctFb = rDr;
        } else if (/^oct_[a-z0-9_]+$/.test(rawOctFb) && rawOctFb.length <= 160) {
          sanitizedOctFb = rawOctFb;
        } else {
          const d = sanitizeModalityDiseaseFeedbackInput(rawOctFb);
          if (!d) {
            return {
              ok: false as const,
              error:
                "Geçersiz OCT doktor değerlendirmesi. Evet (AI onayı) veya listeden bir seçenek kullanın.",
            };
          }
          sanitizedOctFb = d;
        }
      }
    }
    let sanitizedFfaFb: string | undefined;
    if (rawFfaFb && !isModalityDisagreePending(rawFfaFb)) {
      if (isDoctorApprovalToken(rawFfaFb)) {
        sanitizedFfaFb = rawFfaFb;
      } else if (rawFfaFb.startsWith("ffa_json:")) {
        const p = tryParseFfaDoctorFeedbackAny(rawFfaFb);
        if (!p) {
          return {
            ok: false as const,
            error: "Geçersiz FFA kaydı (yapılandırma). Lütfen tekrar seçin.",
          };
        }
        if (p.v === 2) {
          if (!ALLOWED_FFA_FEEDBACK_CODES.has(p.diagnosis)) {
            return {
              ok: false as const,
              error:
                "Geçersiz FFA teşhis kodu. Listeden seçilen kodları kullanın.",
            };
          }
          if (
            p.diagnosis === "ffa_dr" &&
            !String(p.drStage || "").trim()
          ) {
            return {
              ok: false as const,
              error:
                "Diyabetik retinopati seçtiyseniz bir DR evresi de seçmelisiniz.",
            };
          }
          const st = String(p.drStage || "").trim();
          if (st) {
            const rSt = resolveDrLabelToStoredForm(st, locale);
            if (!rSt) {
              return {
                ok: false as const,
                error: "Geçersiz FFA DR evresi. Listeden bir evre seçin.",
              };
            }
          }
        } else {
          const dx = [
            ...new Set(
              p.diagnoses
                .map((x) => String(x || "").trim())
                .filter(Boolean),
            ),
          ];
          if (!dx.length) {
            return {
              ok: false as const,
              error:
                "FFA düzeltmede en az bir tanı seçmelisiniz.",
            };
          }
          if (
            dx.includes(FFA_HEALTHY_VALUE) &&
            dx.length > 1
          ) {
            return {
              ok: false as const,
              error:
                "«Sağlıklı» seçildiğinde başka tanı birlikte seçilemez.",
            };
          }
          for (const c of dx) {
            if (!ALLOWED_FFA_FEEDBACK_CODES.has(c)) {
              return {
                ok: false as const,
                error:
                  "Geçersiz FFA teşhis kodu. Listeden seçilen kodları kullanın.",
              };
            }
          }
          if (dx.includes("ffa_dr")) {
            const st = String(p.drStage || "").trim();
            if (!st) {
              return {
                ok: false as const,
                error:
                  "Diyabetik retinopati seçtiyseniz bir DR evresi de seçmelisiniz.",
              };
            }
            const rSt = resolveDrLabelToStoredForm(st, locale);
            if (!rSt) {
              return {
                ok: false as const,
                error: "Geçersiz FFA DR evresi. Listeden bir evre seçin.",
              };
            }
          }
        }
        sanitizedFfaFb = rawFfaFb.slice(0, MODALITY_DR_FEEDBACK_MAX);
      } else {
        const rDr = resolveDrLabelToStoredForm(rawFfaFb, locale);
        if (rDr) {
          sanitizedFfaFb = rDr;
        } else {
          const d = sanitizeModalityDiseaseFeedbackInput(rawFfaFb);
          if (!d) {
            return {
              ok: false as const,
              error:
                "Geçersiz FFA doktor değerlendirmesi. Evet (AI onayı) veya yeni teşhis/DR formunu tamamlayın.",
            };
          }
          sanitizedFfaFb = d;
        }
      }
    }

    const rawDoctorNote = String(doctorNote || "");

    const sectionLabelsTr: Record<keyof AnalysisReportSectionsInput, string> = {
      reportTitle: "Rapor başlığı",
      reportDate: "Rapor tarihi",
      doctorDisplayName: "Doktor bilgisi",
      anamnesis: "Klinik Öykü (Anamnez)",
      examFindings: "Muayene Bulguları",
      labResults: "Laboratuvar Sonuçları",
      clinicalAssessment: "Teşhis / Klinik Değerlendirme",
      treatmentRecommendations: "Tedavi ve Öneriler",
      doctorNotes: "Doktor Notları",
    };

    let resolvedDoctorNote = rawDoctorNote;
    let structuredForAnalysis: {
      sections: AnalysisReportSectionsInput;
    } | null = null;

    if (reportSections && reportMeta) {
      const secExceed = getFirstExceededReportSection(
        reportSections,
        sectionLabelsTr,
      );
      if (secExceed) {
        return {
          ok: false as const,
          error: `${secExceed.label} alanında maksimum karakter sınırı aşıldı (${secExceed.length}/${REPORT_SECTION_MAX_LEN}).`,
        };
      }
      const octN = String(reportMeta.modalityAppendixOct || "").length;
      const ffaN = String(reportMeta.modalityAppendixFfa || "").length;
      if (octN > REPORT_SECTION_MAX_LEN) {
        return {
          ok: false as const,
          error: `OCT (yapay zeka) eki maksimum karakter sınırını aştı (${octN}/${REPORT_SECTION_MAX_LEN}).`,
        };
      }
      if (ffaN > REPORT_SECTION_MAX_LEN) {
        return {
          ok: false as const,
          error: `FFA (yapay zeka) eki maksimum karakter sınırını aşdı (${ffaN}/${REPORT_SECTION_MAX_LEN}).`,
        };
      }
      resolvedDoctorNote = buildManualReportV2DoctorNoteJson(
        reportSections,
        reportMeta,
      );
      structuredForAnalysis = { sections: reportSections };
    } else if (rawDoctorNote) {
      const exceededField = getExceededReportField(rawDoctorNote);
      if (exceededField) {
        return {
          ok: false as const,
          error: `${exceededField.label} alanında maksimum karakter sınırı aşıldı (${exceededField.value.length}/${REPORT_SECTION_MAX_LEN}).`,
        };
      }
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

    const storedOctImage = octImage
      ? await saveDataObject({
          doctorId: doctor.id,
          patientId,
          category: "oct",
          dataUrlOrBase64: octImage,
        })
      : null;

    const storedFfaImage = ffaImage
      ? await saveDataObject({
          doctorId: doctor.id,
          patientId,
          category: "ffa",
          dataUrlOrBase64: ffaImage,
        })
      : null;

    const parsedInference = aiInferenceSnapshot
      ? parseClientInferenceSnapshot(aiInferenceSnapshot)
      : null;

    const parsedDoctorReview =
      parseDoctorStructuredReviewForStorage(doctorStructuredReview);
    const sanitizedPhysicianReasoning = sanitizePhysicianClinicalReasoning(
      physicianClinicalReasoning,
    );
    const doctorReviewRecord =
      parsedDoctorReview &&
      typeof parsedDoctorReview === "object" &&
      !Array.isArray(parsedDoctorReview)
        ? (parsedDoctorReview as Record<string, unknown>)
        : null;

    const goldDrGradeInt = resolveGoldDrGradeInt({
      feedbackStored: sanitizedFeedback,
      inferenceDrGrade: parsedInference?.drGrade ?? null,
      aiResultStored: resolvedAi,
    });

    const labelQuality = computeTrainingLabelQuality({
      hasDrFeedback: Boolean(sanitizedFeedback),
      physicianReasoning: sanitizedPhysicianReasoning,
      doctorStructuredReview: doctorReviewRecord ?? undefined,
    });

    const parsedComorbidity = parseComorbidityJsonForStorage(comorbidity);
    const uncertaintyVal = uncertaintyScoreFromSnapshot(parsedInference);

    const secs = structuredForAnalysis?.sections;
    const analysisRow = {
      patientId,
      reportKind: prismaReportKindFromMeta(reportMeta),
      aiResult: resolvedAi,
      confidence,
      heatmapUrl: storedHeatmapImage?.url,
      originalImage: storedOriginalImage?.url,
      octImageUrl: storedOctImage?.url,
      ffaImageUrl: storedFfaImage?.url,
      doctorNote: resolvedDoctorNote || undefined,
      reportTitle: secs?.reportTitle || undefined,
      reportDateKey: secs?.reportDate || undefined,
      reportDoctorDisplayName: secs?.doctorDisplayName || undefined,
      sectionAnamnesis: secs?.anamnesis || undefined,
      sectionExamFindings: secs?.examFindings || undefined,
      sectionLabResults: secs?.labResults || undefined,
      sectionClinicalAssessment: secs?.clinicalAssessment || undefined,
      sectionTreatmentRecommendations: secs?.treatmentRecommendations || undefined,
      sectionDoctorNotes: secs?.doctorNotes || undefined,
      comorbidityJson: parsedComorbidity,
      uncertaintyScore: uncertaintyVal ?? undefined,
      ilaclar: sanitizedIlaclar || undefined,
      aiOdriLabels: aiOdriLabels ? JSON.stringify(aiOdriLabels) : null,
      aiOdriConfidences: aiOdriConfidences
        ? JSON.stringify(aiOdriConfidences)
        : null,
      drFeedback: sanitizedFeedback,
      octDrFeedback: sanitizedOctFb,
      ffaDrFeedback: sanitizedFfaFb,
      doctorStructuredReview: parsedDoctorReview,
      physicianClinicalReasoning: sanitizedPhysicianReasoning,
      aiInferenceJson: parsedInference
        ? (parsedInference as unknown as Prisma.InputJsonValue)
        : undefined,
      drGradeInt: goldDrGradeInt,
      datasetSchemaVersion: DATASET_SCHEMA_VERSION,
    } as unknown as Prisma.AnalysisUncheckedCreateInput;

    const diseaseTriage = computeDiseaseTriageFromAnalysisFields({
      drFeedback: sanitizedFeedback ?? null,
      octDrFeedback: sanitizedOctFb ?? null,
      ffaDrFeedback: sanitizedFfaFb ?? null,
    });
    const finalRiskStatus = serializePatientDiseaseTriageForDb(diseaseTriage);

    const combinedDoctorNotesText = buildCombinedDoctorNotesText(
      structuredForAnalysis?.sections,
      resolvedDoctorNote,
    );
    const trainingMlColumns = computeTrainingDatasetEntryFeatureColumns({
      doctorNotesCombinedText: combinedDoctorNotesText,
      parsedInference,
      doctorStructuredReview: doctorReviewRecord,
    });

    /** Eğitim satırı: doktor düzeltmesi yoksa AI ile aynı onay → AI etiketi (null değil). */
    const trainingDatasetDrFeedback = sanitizedFeedback ?? resolvedAi;
    const TRAINING_DOCTOR_NOTES_MAX = 120_000;
    const TRAINING_DOCTOR_NOTE_JSON_MAX = 500_000;
    const trainingDoctorNotesText =
      combinedDoctorNotesText.trim().length > 0
        ? combinedDoctorNotesText.trim().slice(0, TRAINING_DOCTOR_NOTES_MAX)
        : null;
    const trainingDoctorNoteJson =
      resolvedDoctorNote.trim().length > 0
        ? resolvedDoctorNote.trim().slice(0, TRAINING_DOCTOR_NOTE_JSON_MAX)
        : null;

    const savedAnalysis = await prisma.$transaction(async (tx) => {
      const saved = await tx.analysis.create({
        data: analysisRow,
        select: {
          id: true,
          createdAt: true,
        },
      });

      if (storedOriginalImage?.url) {
        const trainingSnapshotJson = buildTrainingInferenceSnapshotV2({
          parsed: parsedInference,
          resolvedAi,
          goldDrGradeInt,
          labelQuality,
          confidence,
        });
        await (
          tx as unknown as PrismaTxTrainingDatasetEntry
        ).trainingDatasetEntry.create(
          {
            data: {
              analysisId: saved.id,
              originalImageUrl: storedOriginalImage.url,
              inferenceSnapshotJson: trainingSnapshotJson,
              drFeedback: trainingDatasetDrFeedback,
              doctorNotesText: trainingDoctorNotesText,
              doctorNote: trainingDoctorNoteJson,
              doctorNotesDerivedDrGradeInt:
                trainingMlColumns.doctorNotesDerivedDrGradeInt,
              microaneurysmCountLevel:
                trainingMlColumns.microaneurysmCountLevel,
              hemorrhageQuadrants: trainingMlColumns.hemorrhageQuadrants,
              hardExudateMacula: trainingMlColumns.hardExudateMacula,
              cottonWoolSpots: trainingMlColumns.cottonWoolSpots,
              venousBeading: trainingMlColumns.venousBeading,
              irma: trainingMlColumns.irma,
              neovascularization: trainingMlColumns.neovascularization,
              trainingDmeSuspected: trainingMlColumns.trainingDmeSuspected,
            },
          },
        );
      }

      await tx.patient.update({
        where: { id: patientId },
        data: {
          risk: finalRiskStatus,
        },
      });

      return saved;
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
        diseaseTriage: diseaseTriage.triage,
        aiResult: resolvedAi,
        confidence,
        objectStorage: {
          original: storedOriginalImage?.url ?? null,
          heatmap: storedHeatmapImage?.url ?? null,
          oct: storedOctImage?.url ?? null,
          ffa: storedFfaImage?.url ?? null,
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
        hasOctImage: Boolean(octImage),
        hasFfaImage: Boolean(ffaImage),
        aiResultLen: String(aiResult || "").length,
        labelsCount: Array.isArray(aiOdriLabels) ? aiOdriLabels.length : 0,
      }),
    });
    const looksLikeMissingColumn =
      /does not exist in the current database|P2022|Unknown column|column .* does not exist/i.test(
        message,
      );
    if (looksLikeMissingColumn) {
      return {
        ok: false as const,
        error:
          "Veritabanı şeması kodla uyumsuz (eksik veya eski sütun). Yönetici: apps/web altında güncel Prisma migration SQL dosyalarını veritabanına uygulayın (ör. prisma migrate deploy veya prisma db execute), ardından npx prisma generate ve geliştirme sunucusunu yeniden başlatın.",
      };
    }

    const looksLikeNullConstraint =
      /Null constraint violation|NOT NULL constraint/i.test(message);
    if (looksLikeNullConstraint) {
      return {
        ok: false as const,
        error:
          "Veritabanında eski tablo tanımı kalmış olabilir (zorunlu sütun / null kısıtı). Güncel migration'ları uygulayın; sorun sürerse TrainingDatasetEntry ve Analysis sütunlarını şema ile karşılaştırın.",
      };
    }

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
          error: `${exceededFieldAfterCatch.label} alanında maksimum karakter sınırı aşıldı (${exceededFieldAfterCatch.value.length}/${REPORT_SECTION_MAX_LEN}).`,
        };
      }
      if (String(ilaclar || "").length > ILACLAR_COLUMN_MAX_LEN) {
        return {
          ok: false as const,
          error: `Tedavi ve Öneriler alanında maksimum karakter sınırı aşıldı (${String(ilaclar || "").length}/${ILACLAR_COLUMN_MAX_LEN}).`,
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
