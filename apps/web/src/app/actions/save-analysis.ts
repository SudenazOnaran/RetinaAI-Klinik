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
import { getDrStageIndexFromLabel, resolveDrLabelToStoredForm } from "@/lib/dr-stage-labels";
import {
  decodeOctMultiSelection,
  decodeModalityAiAlignedLabel,
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
  resolveGoldDrGradeIntFromDoctorFeedback,
} from "@/lib/dataset/training-labels";
import {
  buildCombinedDoctorNotesText,
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
  trainingDatasetEntryOct: {
    create: (args: { data: Record<string, unknown> }) => Promise<{ id: string }>;
  };
  trainingDatasetEntryFfa: {
    create: (args: { data: Record<string, unknown> }) => Promise<{ id: string }>;
  };
};

function extractFundusNvdNve(
  doctorReview: Record<string, unknown> | null | undefined,
): { fundusNvd: number | null; fundusNve: number | null } {
  const fa = doctorReview
    ? doctorReview["fundusAssessment"] ?? doctorReview["fundus_assessment"]
    : null;
  if (!fa || typeof fa !== "object" || Array.isArray(fa)) {
    return { fundusNvd: null, fundusNve: null };
  }
  const nv = (fa as Record<string, unknown>)["neovascularization"];
  if (!nv || typeof nv !== "object" || Array.isArray(nv)) {
    return { fundusNvd: null, fundusNve: null };
  }
  const nvd = (nv as Record<string, unknown>)["nvd"];
  const nve = (nv as Record<string, unknown>)["nve"];
  return {
    fundusNvd: nvd === true ? 1 : nvd === false ? 0 : null,
    fundusNve: nve === true ? 1 : nve === false ? 0 : null,
  };
}

function extractOctTargets(
  octDecision: string | undefined,
): {
  octHealthy: number | null;
  octDme: number | null;
  octAmd: number | null;
  octMacularHole: number | null;
  octErmVmt: number | null;
} {
  const raw = String(octDecision || "").trim();
  if (!raw) {
    return {
      octHealthy: null,
      octDme: null,
      octAmd: null,
      octMacularHole: null,
      octErmVmt: null,
    };
  }
  const multi = decodeOctMultiSelection(raw);
  const labels = multi.length > 0 ? multi : [raw];
  const has = (code: string) => labels.includes(code);
  const healthy = has("oct_saglikli_makula");
  return {
    octHealthy: healthy ? 1 : 0,
    octDme: !healthy && has("oct_dme") ? 1 : 0,
    octAmd: !healthy && has("oct_amd") ? 1 : 0,
    octMacularHole: !healthy && has("oct_macular_hole") ? 1 : 0,
    octErmVmt: !healthy && has("oct_erm") ? 1 : 0,
  };
}

function extractFfaTargets(
  ffaDecision: string | undefined,
): {
  ffaHealthy: number | null;
  ffaDr: number | null;
  ffaRvo: number | null;
  ffaAmdCnv: number | null;
  ffaCsr: number | null;
  ffaUveitis: number | null;
  ffaNvd: number | null;
  ffaNve: number | null;
  ffaDrStage: number | null;
} {
  const raw = String(ffaDecision || "").trim();
  if (!raw) {
    return {
      ffaHealthy: null,
      ffaDr: null,
      ffaRvo: null,
      ffaAmdCnv: null,
      ffaCsr: null,
      ffaUveitis: null,
      ffaNvd: null,
      ffaNve: null,
      ffaDrStage: null,
    };
  }
  const parsed = tryParseFfaDoctorFeedbackAny(raw);
  const diags: string[] =
    parsed?.v === 3
      ? parsed.diagnoses.map((x) => String(x || "").trim()).filter(Boolean)
      : parsed?.v === 2
        ? [String(parsed.diagnosis || "").trim()].filter(Boolean)
        : [];
  const has = (code: string) => diags.includes(code);
  const healthy = has("ffa_healthy");
  const drStageRaw =
    parsed?.v === 3
      ? String(parsed.drStage || "").trim()
      : parsed?.v === 2
        ? String(parsed.drStage || "").trim()
        : "";
  const drStageIdx = drStageRaw ? getDrStageIndexFromLabel(drStageRaw) : null;
  const nvd = parsed && "nvd" in parsed ? parsed.nvd === true : false;
  const nve = parsed && "nve" in parsed ? parsed.nve === true : false;
  const hasDr = !healthy && has("ffa_dr");
  return {
    ffaHealthy: healthy ? 1 : 0,
    ffaDr: hasDr ? 1 : 0,
    ffaRvo: !healthy && has("ffa_rvo") ? 1 : 0,
    ffaAmdCnv: !healthy && has("ffa_amd_cnv") ? 1 : 0,
    ffaCsr: !healthy && has("ffa_csr") ? 1 : 0,
    ffaUveitis: !healthy && has("ffa_uveitis") ? 1 : 0,
    ffaNvd: hasDr && nvd ? 1 : 0,
    ffaNve: hasDr && nve ? 1 : 0,
    ffaDrStage: hasDr && drStageIdx != null ? drStageIdx : null,
  };
}

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
  drFeedback?: string; // Eğitim etiketi için her zaman doktor kararı.
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
        const aligned = decodeModalityAiAlignedLabel(rawOctFb);
        if (!aligned) {
          return {
            ok: false as const,
            error:
              "OCT için «Evet» seçimi açık etiket içermiyor. Lütfen doktor kararını listeden net olarak seçin.",
          };
        }
        sanitizedOctFb = aligned;
      } else {
        const octMulti = decodeOctMultiSelection(rawOctFb);
        if (octMulti.length > 0) {
          const allowedOct = new Set([
            "oct_dme",
            "oct_amd",
            "oct_macular_hole",
            "oct_erm",
            "oct_saglikli_makula",
          ]);
          for (const code of octMulti) {
            if (!allowedOct.has(code)) {
              return {
                ok: false as const,
                error: "Geçersiz OCT çoklu seçim kodu.",
              };
            }
          }
          if (
            octMulti.includes("oct_saglikli_makula") &&
            octMulti.length > 1
          ) {
            return {
              ok: false as const,
              error:
                "OCT'de «sağlıklı/normal makula» seçildiğinde başka seçenek birlikte seçilemez.",
            };
          }
          sanitizedOctFb = rawOctFb;
          // multi kayıt tamam
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
    }
    let sanitizedFfaFb: string | undefined;
    if (rawFfaFb && !isModalityDisagreePending(rawFfaFb)) {
      if (isDoctorApprovalToken(rawFfaFb)) {
        const aligned = decodeModalityAiAlignedLabel(rawFfaFb);
        if (!aligned) {
          return {
            ok: false as const,
            error:
              "FFA için «Evet» seçimi açık etiket içermiyor. Lütfen doktor kararını listeden net olarak seçin.",
          };
        }
        sanitizedFfaFb = aligned;
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

    const goldDrGradeInt = resolveGoldDrGradeIntFromDoctorFeedback(
      sanitizedFeedback,
    );

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
    const fundusNvdNve = extractFundusNvdNve(doctorReviewRecord);

    /** Eğitim etiketi: yalnızca doktor kararı (0..4) */
    const trainingDatasetDrFeedback =
      goldDrGradeInt != null && goldDrGradeInt >= 0 && goldDrGradeInt <= 4
        ? goldDrGradeInt
        : null;
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
    const ffaTargets = extractFfaTargets(sanitizedFfaFb);

    const savedAnalysis = await prisma.$transaction(async (tx) => {
      const saved = await tx.analysis.create({
        data: analysisRow,
        select: {
          id: true,
          createdAt: true,
        },
      });

      if (storedOriginalImage?.url) {
        if (trainingDatasetDrFeedback == null) {
          throw new Error(
            "Eğitim kaydı için fundus doktor kararı zorunludur. Lütfen DR etiketini doktor olarak onaylayın/seçin.",
          );
        }
        await (
          tx as unknown as PrismaTxTrainingDatasetEntry
        ).trainingDatasetEntry.create(
          {
            data: {
              analysisId: saved.id,
              originalImageUrl: storedOriginalImage.url,
              drFeedback: trainingDatasetDrFeedback,
              doctorNotesText: trainingDoctorNotesText,
              doctorNote: trainingDoctorNoteJson,
              fundusNvd: fundusNvdNve.fundusNvd,
              fundusNve: fundusNvdNve.fundusNve,
            },
          },
        );
      }

      if (storedOctImage?.url) {
        if (!sanitizedOctFb) {
          throw new Error(
            "Egitim kaydi icin OCT doktor karari zorunludur. Lutfen OCT tanisini secin.",
          );
        }
        const octTargets = extractOctTargets(sanitizedOctFb);
        await (
          tx as unknown as PrismaTxTrainingDatasetEntry
        ).trainingDatasetEntryOct.create({
          data: {
            analysisId: saved.id,
            octImageUrl: storedOctImage.url,
            octDoctorDecision: sanitizedOctFb,
            octHealthy: octTargets.octHealthy,
            octDme: octTargets.octDme,
            octAmd: octTargets.octAmd,
            octMacularHole: octTargets.octMacularHole,
            octErmVmt: octTargets.octErmVmt,
          },
        });
      }

      if (storedFfaImage?.url) {
        if (!sanitizedFfaFb) {
          throw new Error(
            "Egitim kaydi icin FFA doktor karari zorunludur. Lutfen FFA tani/evre secimini tamamlayin.",
          );
        }
        await (
          tx as unknown as PrismaTxTrainingDatasetEntry
        ).trainingDatasetEntryFfa.create({
          data: {
            analysisId: saved.id,
            ffaImageUrl: storedFfaImage.url,
            ffaDoctorDecision: sanitizedFfaFb,
            ffaHealthy: ffaTargets.ffaHealthy,
            ffaDr: ffaTargets.ffaDr,
            ffaRvo: ffaTargets.ffaRvo,
            ffaAmdCnv: ffaTargets.ffaAmdCnv,
            ffaCsr: ffaTargets.ffaCsr,
            ffaUveitis: ffaTargets.ffaUveitis,
            ffaNvd: ffaTargets.ffaNvd,
            ffaNve: ffaTargets.ffaNve,
            ffaDrStage: ffaTargets.ffaDrStage,
          },
        });
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
