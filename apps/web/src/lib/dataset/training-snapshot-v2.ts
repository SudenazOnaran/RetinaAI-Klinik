import type { Prisma } from "@prisma/client";
import {
  DR_STAGE_LABELS_EN,
  DR_STAGE_LABELS_TR,
  getDrStageIndexFromLabel,
} from "@/lib/dr-stage-labels";
import {
  DATASET_SCHEMA_VERSION,
  type AiInferenceSnapshot,
} from "./snapshot";
import type { TrainingLabelQuality } from "./training-labels";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Eğitim satırı `inferenceSnapshotJson` sürümü.
 *
 * Amaç: görüntü modeli başlıkları tek yerde, net ayrılmış:
 * - `from_image`: CNN’in pikselden öğrenmesi hedeflenen sinyaller (DR sınıfı, DME, fundus bayrakları).
 * - `from_teacher_text`: öğretmen (LLM) metin/triyaj; ayrı distillation veya rapor başlığı.
 * - `provenance`: PyTorch / LLM meta + etiket kalitesi.
 */
export const TRAINING_SNAPSHOT_VERSION = "training_snapshot_v2" as const;

export type TrainingInferenceSnapshotV2 = {
  version: typeof TRAINING_SNAPSHOT_VERSION;
  from_image: {
    dr_grade: {
      /** Eğitim kaybı için nihai sınıf 0–4 (doktor > öğretmen > metin) */
      gold_index: number;
      /** Servis/LLM öğretmen sınıfı (curriculum, hata analizi) */
      teacher_index: number;
      label_tr: string;
      label_en: string;
      teacher_confidence: number | null;
    };
    dme: {
      suspected: boolean | null;
      confidence: number | null;
    };
    fundus_findings: Record<string, boolean> | null;
    /** LLM/doktor hizasi yapilandirilmis lezyon + 4-2-1 + makula + fundustan dislananlar */
    fundus_assessment: Record<string, unknown> | null;
  };
  from_teacher_text: {
    clinical_reasoning_tr?: string;
    uncertainty_note?: string;
    clinical_decision?: Record<string, unknown>;
    odir?: Record<string, unknown>;
  };
  provenance: {
    pytorch?: Record<string, unknown>;
    llm?: Record<string, unknown>;
    label_quality: TrainingLabelQuality;
    ai_confidence_at_save: number | null;
    /** Kaynak istemci snapshot şeması (Analysis.aiInferenceJson ile uyum) */
    legacy_snapshot_schema: typeof DATASET_SCHEMA_VERSION;
  };
};

/**
 * Kayıt anında: istemci AI snapshot + çözülmüş altın evre → eğitim JSON’u.
 */
export function buildTrainingInferenceSnapshotV2(params: {
  parsed: AiInferenceSnapshot | null;
  resolvedAi: string;
  goldDrGradeInt: number | null;
  labelQuality: TrainingLabelQuality;
}): Prisma.InputJsonValue {
  const teacherIdx =
    params.parsed?.drGrade ?? getDrStageIndexFromLabel(params.resolvedAi);
  const fallbackTeacher = teacherIdx ?? 0;
  const goldIdx =
    params.goldDrGradeInt !== null &&
    params.goldDrGradeInt >= 0 &&
    params.goldDrGradeInt <= 4
      ? params.goldDrGradeInt
      : fallbackTeacher;

  const labelTr = DR_STAGE_LABELS_TR[goldIdx] ?? params.resolvedAi;
  const labelEn =
    (typeof params.parsed?.drLabel === "string" && params.parsed.drLabel
      ? params.parsed.drLabel
      : DR_STAGE_LABELS_EN[goldIdx]) ?? DR_STAGE_LABELS_EN[goldIdx];

  const fromTeacher: TrainingInferenceSnapshotV2["from_teacher_text"] = {};
  if (params.parsed?.clinicalReasoning) {
    fromTeacher.clinical_reasoning_tr = params.parsed.clinicalReasoning;
  }
  if (params.parsed?.uncertaintyNote) {
    fromTeacher.uncertainty_note = params.parsed.uncertaintyNote;
  }
  if (params.parsed?.clinicalDecision) {
    fromTeacher.clinical_decision = params.parsed.clinicalDecision;
  }
  if (params.parsed?.odir) {
    fromTeacher.odir = params.parsed.odir;
  }

  const out: TrainingInferenceSnapshotV2 = {
    version: TRAINING_SNAPSHOT_VERSION,
    from_image: {
      dr_grade: {
        gold_index: goldIdx,
        teacher_index: fallbackTeacher,
        label_tr: String(labelTr),
        label_en: String(labelEn),
        teacher_confidence: null,
      },
      dme: {
        suspected:
          typeof params.parsed?.dmeSuspected === "boolean"
            ? params.parsed.dmeSuspected
            : null,
        confidence:
          typeof params.parsed?.dmeConfidence === "number"
            ? params.parsed.dmeConfidence
            : null,
      },
      fundus_findings: params.parsed?.fundusFindings
        ? { ...params.parsed.fundusFindings }
        : null,
      fundus_assessment: isRecord(params.parsed?.fundusAssessment)
        ? { ...params.parsed.fundusAssessment }
        : null,
    },
    from_teacher_text: fromTeacher,
    provenance: {
      ...(params.parsed?.pytorch ? { pytorch: params.parsed.pytorch } : {}),
      ...(params.parsed?.inference ? { llm: params.parsed.inference } : {}),
      label_quality: params.labelQuality,
      ai_confidence_at_save: null,
      legacy_snapshot_schema: DATASET_SCHEMA_VERSION,
    },
  };

  return out as unknown as Prisma.InputJsonValue;
}
