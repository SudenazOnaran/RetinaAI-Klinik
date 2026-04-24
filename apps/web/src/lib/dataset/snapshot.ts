import type { Prisma } from "@prisma/client";

/** Veri seti şeması (export ile uyumlu üst alan). */
export const DATASET_SCHEMA_VERSION = "1" as const;

export type DatasetSchemaVersion = typeof DATASET_SCHEMA_VERSION;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/** API `uncertainty` / `uncertaintyScore` veya 1 − DR güveni (0–1, yüksek = daha belirsiz). */
export function deriveUncertaintyScoreFromPredict(
  raw: Record<string, unknown>,
): number | undefined {
  const u = Number(raw.uncertainty);
  if (Number.isFinite(u) && u >= 0 && u <= 1) return clamp01(u);
  const us = Number(raw.uncertaintyScore);
  if (Number.isFinite(us) && us >= 0 && us <= 1) return clamp01(us);
  const pt = raw.pytorch;
  if (isRecord(pt)) {
    const c = Number(pt.confidence);
    if (Number.isFinite(c) && c >= 0 && c <= 1) return clamp01(1 - c);
  }
  return undefined;
}

const MAX_DOCTOR_STRUCTURED_REVIEW_JSON_CHARS = 48_000;
export const PHYSICIAN_CLINICAL_REASONING_MAX_LEN = 12_000;

/** İstemciden gelen doktor yapısal incelemesi (Prisma Json öncesi). */
export function parseDoctorStructuredReviewForStorage(
  raw: unknown,
): Prisma.InputJsonValue | undefined {
  if (raw == null) return undefined;
  if (!isRecord(raw)) return undefined;
  try {
    const s = JSON.stringify(raw);
    if (s.length > MAX_DOCTOR_STRUCTURED_REVIEW_JSON_CHARS) return undefined;
  } catch {
    return undefined;
  }
  return raw as Prisma.InputJsonValue;
}

export function sanitizePhysicianClinicalReasoning(
  raw: string | null | undefined,
): string | undefined {
  const t = String(raw ?? "").trim();
  if (!t) return undefined;
  return t.slice(0, PHYSICIAN_CLINICAL_REASONING_MAX_LEN);
}

/** AI /predict yanıtından DB’de saklanacak yapı (heatmap base64 hariç). */
export type AiInferenceSnapshot = {
  schemaVersion: DatasetSchemaVersion;
  drGrade: number;
  pytorch?: Record<string, unknown>;
  odir?: Record<string, unknown>;
  fundusFindings?: Record<string, boolean>;
  /** `fundus_assessment_v1`: lezyon detayı, 4-2-1, makula, DME dolaylı, fundustan değerlendirilemeyenler */
  fundusAssessment?: Record<string, unknown>;
  drLabel?: string;
  clinicalReasoning?: string;
  clinicalDecision?: Record<string, unknown>;
  dmeSuspected?: boolean;
  dmeConfidence?: number;
  uncertaintyNote?: string;
  /** 0–1; yüksek = daha belirsiz (model / görüntü) */
  uncertaintyScore?: number;
  inference?: Record<string, unknown>;
  heatmapStoredSeparately?: boolean;
};

export function uncertaintyScoreFromSnapshot(
  snap: AiInferenceSnapshot | null | undefined,
): number | undefined {
  if (!snap) return undefined;
  if (typeof snap.uncertaintyScore === "number")
    return clamp01(snap.uncertaintyScore);
  const pt = snap.pytorch;
  if (isRecord(pt)) {
    const c = Number(pt.confidence);
    if (Number.isFinite(c) && c >= 0 && c <= 1) return clamp01(1 - c);
  }
  return undefined;
}

/** predict JSON gövdesinden base64 heatmap çıkarır; depolama için. */
export function stripPredictResponseForStorage(
  raw: unknown,
): AiInferenceSnapshot | null {
  if (!isRecord(raw) || raw.success !== true) return null;

  const drGrade = Number(raw.drGrade);
  const grade =
    Number.isFinite(drGrade) && drGrade >= 0 && drGrade <= 4
      ? Math.round(drGrade)
      : null;
  if (grade === null) return null;

  const inference = isRecord(raw.inference) ? { ...raw.inference } : undefined;
  const pytorch = isRecord(raw.pytorch) ? { ...raw.pytorch } : undefined;
  const odir = isRecord(raw.odir) ? { ...raw.odir } : undefined;
  const clinicalDecision = isRecord(raw.clinicalDecision)
    ? { ...raw.clinicalDecision }
    : undefined;
  const fundus = raw.fundusFindings;
  const fundusFindings = isRecord(fundus)
    ? (fundus as Record<string, boolean>)
    : undefined;

  const fa = raw.fundusAssessment;
  return {
    schemaVersion: DATASET_SCHEMA_VERSION,
    drGrade: grade,
    pytorch,
    odir,
    fundusFindings,
    fundusAssessment: isRecord(fa) ? { ...fa } : undefined,
    drLabel:
      typeof raw.drLabel === "string" ? raw.drLabel : undefined,
    clinicalReasoning:
      typeof raw.clinicalReasoning === "string"
        ? raw.clinicalReasoning.slice(0, 8000)
        : undefined,
    clinicalDecision,
    dmeSuspected:
      typeof raw.dmeSuspected === "boolean" ? raw.dmeSuspected : undefined,
    dmeConfidence:
      typeof raw.dmeConfidence === "number" ? raw.dmeConfidence : undefined,
    uncertaintyNote:
      typeof raw.uncertaintyNote === "string"
        ? raw.uncertaintyNote.slice(0, 4000)
        : undefined,
    uncertaintyScore: deriveUncertaintyScoreFromPredict(raw),
    inference,
    heatmapStoredSeparately: Boolean(
      typeof raw.heatmapPlus === "string" && raw.heatmapPlus.length > 0,
    ),
  };
}

/** Server action: istemciden gelen snapshot’ı doğrula (Prisma Json öncesi). */
export function parseClientInferenceSnapshot(
  raw: unknown,
): AiInferenceSnapshot | null {
  if (!isRecord(raw)) return null;
  if (raw.schemaVersion !== DATASET_SCHEMA_VERSION) return null;
  const g = Number(raw.drGrade);
  if (!Number.isInteger(g) || g < 0 || g > 4) return null;
  const fundus = raw.fundusFindings;
  const faIn = raw.fundusAssessment;
  return {
    schemaVersion: DATASET_SCHEMA_VERSION,
    drGrade: g,
    pytorch: isRecord(raw.pytorch) ? raw.pytorch : undefined,
    odir: isRecord(raw.odir) ? raw.odir : undefined,
    fundusFindings: isRecord(fundus)
      ? (fundus as Record<string, boolean>)
      : undefined,
    fundusAssessment: isRecord(faIn) ? { ...faIn } : undefined,
    drLabel: typeof raw.drLabel === "string" ? raw.drLabel : undefined,
    clinicalReasoning:
      typeof raw.clinicalReasoning === "string"
        ? raw.clinicalReasoning.slice(0, 8000)
        : undefined,
    clinicalDecision: isRecord(raw.clinicalDecision)
      ? raw.clinicalDecision
      : undefined,
    dmeSuspected:
      typeof raw.dmeSuspected === "boolean" ? raw.dmeSuspected : undefined,
    dmeConfidence:
      typeof raw.dmeConfidence === "number" ? raw.dmeConfidence : undefined,
    uncertaintyNote:
      typeof raw.uncertaintyNote === "string"
        ? raw.uncertaintyNote.slice(0, 4000)
        : undefined,
    uncertaintyScore: (() => {
      const x = Number(raw.uncertaintyScore);
      if (Number.isFinite(x) && x >= 0 && x <= 1) return clamp01(x);
      const pt = raw.pytorch;
      if (isRecord(pt)) {
        const c = Number(pt.confidence);
        if (Number.isFinite(c) && c >= 0 && c <= 1) return clamp01(1 - c);
      }
      return undefined;
    })(),
    inference: isRecord(raw.inference) ? raw.inference : undefined,
    heatmapStoredSeparately:
      raw.heatmapStoredSeparately === true ? true : undefined,
  };
}
