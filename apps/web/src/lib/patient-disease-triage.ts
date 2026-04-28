/**
 * Üç modalite (fundus / OCT / FFA) doktor geri bildiriminden rutin–acil triajı ve özet metni.
 * Kayıt şeması: `Patient.risk` için `__DTG__:` önekli string (bkz. `serializePatientDiseaseTriageForDb`).
 */

import { decodeModalityAiAlignedLabel, isDoctorApprovalToken, isModalityDisagreePending } from "@/lib/doctor-feedback";
import { getDrStageIndexFromLabel } from "@/lib/dr-stage-labels";
import {
  humanizeEmbeddedFfaJsonInText,
  humanizeFfaDoctorFeedbackForSummary,
} from "@/lib/ffa-doctor-feedback-display";
import { tryParseFfaDoctorFeedbackAny } from "@/lib/ffa-doctor-feedback-json";
import {
  FFA_HEALTHY_VALUE,
  OCT_HEALTHY_VALUE,
} from "@/lib/modality-risk-surface";

export type DiseaseTriageLevel = "routine" | "urgent" | "pending";

const PREFIX = "__DTG__:";

export type ModalityDoctorFeedbackFields = {
  drFeedback?: string | null;
  octDrFeedback?: string | null;
  ffaDrFeedback?: string | null;
};

function trimRaw(v: string | null | undefined): string {
  return String(v ?? "").trim();
}

/** Tek modalite için: boş / rutin / acil / bekliyor (tamamlanmamış düzeltme). */
export type ModalitySlice = "none" | "routine" | "urgent" | "pending";

/** Fundus `drFeedback` — OCT `oct_*` kodları beklenmez. */
function classifyFundus(raw: string): ModalitySlice {
  const s = trimRaw(raw);
  if (!s || s === "null") return "none";
  if (isModalityDisagreePending(s)) return "pending";
  if (isDoctorApprovalToken(s)) return "routine";

  const idx = getDrStageIndexFromLabel(s);
  if (idx !== null) {
    if (idx === 0) return "routine";
    return "urgent";
  }

  /* Çözülemeyen metin → doktor düzeltmesi (patoloji varsayımı). */
  return "urgent";
}

function classifyFfa(raw: string): ModalitySlice {
  const s = trimRaw(raw);
  if (!s || s === "null") return "none";
  if (isModalityDisagreePending(s)) return "pending";
  if (isDoctorApprovalToken(s)) return "routine";

  const parsedAny = tryParseFfaDoctorFeedbackAny(s);
  if (parsedAny?.v === 3) {
    const dx = parsedAny.diagnoses.map((x) => x.trim()).filter(Boolean);
    if (dx.length === 0) return "pending";
    const onlyHealthy =
      dx.length === 1 && dx[0] === FFA_HEALTHY_VALUE;
    if (onlyHealthy) return "routine";
    if (dx.includes("ffa_dr")) {
      const st = trimRaw(parsedAny.drStage ?? "");
      if (!st) return "pending";
      const idx = getDrStageIndexFromLabel(st);
      if (idx === null) return "urgent";
      if (idx === 0) return "routine";
      return "urgent";
    }
    return "urgent";
  }

  const parsed = parsedAny?.v === 2 ? parsedAny : null;
  if (parsed && parsed.v === 2) {
    if (parsed.diagnosis === "ffa_dr") {
      const st = trimRaw(parsed.drStage ?? "");
      if (!st) return "pending";
      const idx = getDrStageIndexFromLabel(st);
      if (idx === null) return "urgent";
      if (idx === 0) return "routine";
      return "urgent";
    }
    if (parsed.diagnosis === FFA_HEALTHY_VALUE) return "routine";
    /* Diğer FFA tanıları (RVO, CSR, …) → patoloji */
    return "urgent";
  }

  const idx = getDrStageIndexFromLabel(s);
  if (idx !== null) {
    if (idx === 0) return "routine";
    return "urgent";
  }

  return classifyFundus(s);
}

/** AI «Evet» ile saklanan düz etiket (mai: sonrası) veya oct_* kodları. */
function classifyOctEffectivePlain(effective: string): ModalitySlice {
  const low = effective.trim().toLowerCase();
  if (!low) return "none";

  if (low.startsWith("oct_")) {
    if (low === OCT_HEALTHY_VALUE.toLowerCase()) return "routine";
    return "urgent";
  }

  if (
    /\bdme\b|diabetik\s+makula|makula\s+ödem|maküler|macular\s+edema/i.test(
      effective,
    )
  ) {
    return "urgent";
  }
  if (
    /\bamd\b|cnv\b|neovaskülar|neovascular/i.test(effective) ||
    /\b(delik|hole)\b/i.test(effective) ||
    /\berm\b|epiretinal|vmt\b/i.test(effective)
  ) {
    return "urgent";
  }

  if (
    /sağlıklı|saglikli|normal\s+makula|healthy|normal\s+macula/i.test(effective)
  ) {
    return "routine";
  }

  return classifyFundus(effective);
}

function classifyOct(raw: string): ModalitySlice {
  const s = trimRaw(raw);
  if (!s || s === "null") return "none";
  if (isModalityDisagreePending(s)) return "pending";

  const maiDecoded = decodeModalityAiAlignedLabel(s);
  if (maiDecoded) {
    return classifyOctEffectivePlain(maiDecoded);
  }

  if (isDoctorApprovalToken(s)) return "routine";

  return classifyOctEffectivePlain(s);
}

export type DiseaseTriageResult = {
  triage: DiseaseTriageLevel;
  /** Kritik panel / acil rozet */
  isUrgent: boolean;
  /** Anlamlı doktor girdisi var mı (boş değil)? */
  hasAnyDoctorInput: boolean;
  fundus: ModalitySlice;
  oct: ModalitySlice;
  ffa: ModalitySlice;
  /** Kısa gösterim (liste / hasta kartı) */
  summaryLine: string;
};

function slicesAggregate(f: ModalitySlice, o: ModalitySlice, ff: ModalitySlice): DiseaseTriageLevel {
  const meaningful = [f, o, ff].filter((x) => x !== "none");
  if (meaningful.length === 0) return "pending";

  if (meaningful.some((x) => x === "pending")) return "pending";
  if (meaningful.some((x) => x === "urgent")) return "urgent";
  return "routine";
}

function buildSummaryLine(
  fields: ModalityDoctorFeedbackFields,
  fundus: ModalitySlice,
  oct: ModalitySlice,
  ffa: ModalitySlice,
): string {
  const parts: string[] = [];
  const dr = trimRaw(fields.drFeedback);
  const oc = trimRaw(fields.octDrFeedback);
  const ff = trimRaw(fields.ffaDrFeedback);

  const push = (label: string, raw: string, slice: ModalitySlice) => {
    if (slice === "none") return;
    if (!raw || raw === "null") return;
    if (isModalityDisagreePending(raw)) return;
    let display = raw;
    const mai = decodeModalityAiAlignedLabel(raw);
    if (mai) {
      display = mai;
    } else if (label === "FFA") {
      display = humanizeFfaDoctorFeedbackForSummary(raw);
    } else if (isDoctorApprovalToken(raw)) {
      display = "AI ile uyumlu";
    } else if (raw.length > 96) {
      display = `${raw.slice(0, 93)}…`;
    }
    parts.push(`${label}: ${display}`);
  };

  push("Fundus", dr, fundus);
  push("OCT", oc, oct);
  push("FFA", ff, ffa);

  return parts.join(" · ") || "—";
}

/**
 * Son analiz satırından triaj (Patient.risk ve liste ile uyumlu).
 */
export function computeDiseaseTriageFromAnalysisFields(
  fields: ModalityDoctorFeedbackFields,
): DiseaseTriageResult {
  const fundus = classifyFundus(fields.drFeedback ?? "");
  const oct = classifyOct(fields.octDrFeedback ?? "");
  const ffa = classifyFfa(fields.ffaDrFeedback ?? "");

  const triage = slicesAggregate(fundus, oct, ffa);
  const hasAnyDoctorInput = [fundus, oct, ffa].some((x) => x !== "none");

  const summaryLine = buildSummaryLine(fields, fundus, oct, ffa);

  return {
    triage,
    isUrgent: triage === "urgent",
    hasAnyDoctorInput,
    fundus,
    oct,
    ffa,
    summaryLine,
  };
}

export function participatesInCriticalPanel(result: DiseaseTriageResult): boolean {
  return result.triage === "urgent";
}

/** DB `Patient.risk` — makine + kısa özet; geriye dönük satırlar önek içermez. */
export function serializePatientDiseaseTriageForDb(result: DiseaseTriageResult): string {
  const tag = result.triage.toUpperCase();
  const body = result.summaryLine.replace(/\|/g, "¦");
  return `${PREFIX}${tag}|${body}`;
}

export function parseStoredPatientDiseaseTriage(
  risk: string | null | undefined,
): DiseaseTriageLevel | null {
  const s = String(risk ?? "").trim();
  if (!s.startsWith(PREFIX)) return null;
  const rest = s.slice(PREFIX.length);
  const pipe = rest.indexOf("|");
  const head = pipe >= 0 ? rest.slice(0, pipe) : rest;
  const u = head.toUpperCase();
  if (u.startsWith("ROUTINE")) return "routine";
  if (u.startsWith("URGENT")) return "urgent";
  if (u.startsWith("PENDING")) return "pending";
  return null;
}

/** Özet çizgisi (liste hücresi için). */
export function extractSummaryFromStoredPatientRisk(
  risk: string | null | undefined,
  locale: "tr" | "en" = "tr",
): string | null {
  const s = String(risk ?? "").trim();
  if (!s.startsWith(PREFIX)) return null;
  const pipe = s.indexOf("|");
  if (pipe < 0) return null;
  const body = s.slice(pipe + 1).trim();
  const line = body.replace(/¦/g, "|") || null;
  if (!line) return null;
  return humanizeEmbeddedFfaJsonInText(line, locale);
}

/** Dashboard / rozetler için `Patient.risk` tek satır gösterimi (ham `__DTG__` / `ffa_json` yok). */
export function formatPatientRiskForUi(
  risk: string | null | undefined,
  locale: "tr" | "en" = "tr",
): string {
  const r = String(risk ?? "").trim();
  if (!r) return "—";
  const fromStored = extractSummaryFromStoredPatientRisk(r, locale);
  if (fromStored) return fromStored;
  return humanizeEmbeddedFfaJsonInText(r, locale);
}
