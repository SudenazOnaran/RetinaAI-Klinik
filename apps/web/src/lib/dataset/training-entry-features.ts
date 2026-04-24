/**
 * TrainingDatasetEntry için tablo sütunları: doktor notlarından DR ifadesi + fundus_assessment (ve doktor override) ile lezyon / DME etiketleri.
 * Glokom / AMD çıktı etiketi olarak kullanılmaz (fundus_assessment.not_assessable_from_fundus bilgi amaçlı kalır).
 */
import type { AiInferenceSnapshot } from "./snapshot";
import type { AnalysisReportSectionsInput } from "./analysis-report-sections";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function normalizeSearchText(s: string): string {
  return String(s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Doktor notları + klinik metinlerden DR 0–4 (ifade eşlemesi); eşleşme yoksa null. */
export function parseDrGradeFromDoctorNotesText(raw: string): number | null {
  const t = normalizeSearchText(raw);
  if (!t) return null;

  if (/\bmild\s+ile\s+uyumlu\b/.test(t) || /hafif\s+ile\s+uyumlu/.test(t)) {
    return 1;
  }
  if (
    /\bpdr\b/.test(t) ||
    /\bproliferatif\b/.test(t) ||
    /\bproliferative\b/.test(t)
  ) {
    return 4;
  }
  if (/\bsevere\b/.test(t) || /\bsiddetli\b/.test(t) || /\bevre\s*3\b/.test(t)) {
    return 3;
  }
  if (/\bmoderate\b/.test(t) || /\borta\b/.test(t) || /\bevre\s*2\b/.test(t)) {
    return 2;
  }
  if (
    /\bmild\b/.test(t) ||
    /\bhafif\b/.test(t) ||
    /\bevre\s*1\b/.test(t)
  ) {
    return 1;
  }
  if (
    /\bsaglikli\b/.test(t) ||
    /\bhealthy\b/.test(t) ||
    /\bno\s*dr\b/.test(t) ||
    /\bevre\s*0\b/.test(t) ||
    /\bstage\s*0\b/.test(t)
  ) {
    return 0;
  }
  return null;
}

export function buildCombinedDoctorNotesText(
  sections: AnalysisReportSectionsInput | undefined,
  legacyDoctorNoteJsonOrPlain: string,
): string {
  const parts: string[] = [];
  if (sections) {
    for (const k of [
      "doctorNotes",
      "clinicalAssessment",
      "examFindings",
      "treatmentRecommendations",
    ] as const) {
      const v = sections[k]?.trim();
      if (v) parts.push(v);
    }
  } else if (legacyDoctorNoteJsonOrPlain.trim()) {
    try {
      const j = JSON.parse(legacyDoctorNoteJsonOrPlain) as {
        sections?: Partial<Record<string, string>>;
        doctorNotes?: string;
      };
      if (j?.sections) {
        for (const key of [
          "clinicalAssessment",
          "examFindings",
          "treatmentRecommendations",
        ]) {
          const v = j.sections[key as keyof typeof j.sections]?.trim();
          if (v) parts.push(v);
        }
      }
      const dn = j?.doctorNotes?.trim();
      if (dn) parts.push(dn);
    } catch {
      parts.push(legacyDoctorNoteJsonOrPlain);
    }
  }
  return parts.join("\n\n");
}

function presence01(p: unknown): number | null {
  if (p == null) return null;
  const s = String(p).trim().toLowerCase();
  if (s === "absent") return 0;
  if (s === "present") return 1;
  return null;
}

function optBool01(v: unknown): number | null {
  if (v === true) return 1;
  if (v === false) return 0;
  return null;
}

function mergeLesion(
  base: Record<string, unknown>,
  key: string,
  over: Record<string, unknown>,
): void {
  const bSub = isRecord(base[key]) ? { ...(base[key] as object) } : {};
  const oSub = over[key];
  if (isRecord(oSub)) {
    base[key] = { ...bSub, ...oSub };
  }
}

/** AI fundus_assessment üzerine doktor structured review fundus_assessment yapıştırır. */
export function mergeFundusAssessments(
  ai: Record<string, unknown> | null | undefined,
  doctorReview: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  const docFa = doctorReview
    ? doctorReview["fundusAssessment"] ?? doctorReview["fundus_assessment"]
    : undefined;
  const docRec = isRecord(docFa) ? docFa : null;

  if (!ai && !docRec) return null;
  if (!docRec) return ai ? { ...ai } : null;
  if (!ai) return { ...docRec };

  const out: Record<string, unknown> = { ...ai };
  const lesionKeys = [
    "microaneurysm",
    "hemorrhage",
    "hard_exudates",
    "cotton_wool_spots",
    "venous_beading",
    "irma",
    "neovascularization",
  ] as const;
  for (const k of lesionKeys) {
    mergeLesion(out, k, docRec);
  }
  for (const k of [
    "quadrant_distribution",
    "rule_4_2_1",
    "macula",
    "dme_indirect",
    "lesion_severity",
  ] as const) {
    mergeLesion(out, k, docRec);
  }
  return out;
}

export type TrainingEntryMlColumns = {
  doctorNotesDerivedDrGradeInt: number | null;
  microaneurysmCountLevel: number | null;
  hemorrhageQuadrants: number | null;
  hardExudateMacula: number | null;
  cottonWoolSpots: number | null;
  venousBeading: number | null;
  irma: number | null;
  neovascularization: number | null;
  trainingDmeSuspected: number | null;
};

function microaneurysmCountLevelFromFa(
  fa: Record<string, unknown> | null,
): number | null {
  if (!fa) return null;
  const ma = fa.microaneurysm;
  if (!isRecord(ma)) return null;
  const pres = presence01(ma.presence);
  if (pres === 0) return 0;
  if (pres === null) return null;
  const burden = String(ma.burden || "").toLowerCase();
  if (burden === "widespread") return 2;
  return 1;
}

function hemorrhageQuadrantsFromFa(
  fa: Record<string, unknown> | null,
): number | null {
  if (!fa) return null;
  const qd = fa.quadrant_distribution;
  if (isRecord(qd)) {
    const cnt = Number(qd.hemorrhage_quadrant_count);
    if (Number.isInteger(cnt) && cnt >= 0 && cnt <= 4) return cnt;
  }
  const h = fa.hemorrhage;
  if (isRecord(h)) {
    const qa = Number(h.quadrants_affected);
    if (Number.isInteger(qa) && qa >= 0 && qa <= 4) return qa;
    const hp = presence01(h.presence);
    if (hp === 0) return 0;
  }
  return null;
}

function hardExudateMaculaFromFa(fa: Record<string, unknown> | null): number | null {
  if (!fa) return null;
  const mac = fa.macula;
  const he = fa.hard_exudates;
  const nearFromMac = isRecord(mac)
    ? optBool01(mac.hard_exudates_near_macula)
    : null;
  const nearFromHe = isRecord(he) ? optBool01(he.near_macula) : null;
  const merged = nearFromMac ?? nearFromHe;
  if (merged !== null) return merged;
  return null;
}

function nvFromFa(fa: Record<string, unknown> | null): number | null {
  if (!fa) return null;
  const nv = fa.neovascularization;
  if (!isRecord(nv)) return null;
  if (optBool01(nv.nvd) === 1 || optBool01(nv.nve) === 1) return 1;
  return presence01(nv.presence);
}

function lesionPresence01(
  fa: Record<string, unknown> | null,
  key: string,
): number | null {
  if (!fa) return null;
  const sub = fa[key];
  if (!isRecord(sub)) return null;
  return presence01(sub.presence);
}

function fundusFindingsFallback(
  ff: Record<string, boolean> | null | undefined,
): Partial<{
  microaneurysmCountLevel: number;
  cottonWoolSpots: number;
  venousBeading: number;
  irma: number;
  neovascularization: number;
  hemorrhageQuadrants: number;
  hardExudateMacula: number;
  dme: number;
}> {
  if (!ff) return {};
  const o: Partial<{
    microaneurysmCountLevel: number;
    cottonWoolSpots: number;
    venousBeading: number;
    irma: number;
    neovascularization: number;
    hemorrhageQuadrants: number;
    hardExudateMacula: number;
    dme: number;
  }> = {};
  if (ff.microaneurysm === false) o.microaneurysmCountLevel = 0;
  else if (ff.microaneurysm === true) o.microaneurysmCountLevel = 1;
  if (ff.cotton_wool_spots === true) o.cottonWoolSpots = 1;
  else if (ff.cotton_wool_spots === false) o.cottonWoolSpots = 0;
  if (ff.venous_beading === true) o.venousBeading = 1;
  else if (ff.venous_beading === false) o.venousBeading = 0;
  if (ff.irma === true) o.irma = 1;
  else if (ff.irma === false) o.irma = 0;
  if (ff.neovascularization === true) o.neovascularization = 1;
  else if (ff.neovascularization === false) o.neovascularization = 0;
  if (ff.hemorrhage === false) o.hemorrhageQuadrants = 0;
  if (ff.hard_exudates === true && ff.macular_edema_suspected === true) {
    o.hardExudateMacula = 1;
  }
  if (ff.macular_edema_suspected === true) o.dme = 1;
  return o;
}

function computeTrainingDmeSuspected(
  fa: Record<string, unknown> | null,
  fundusFindings: Record<string, boolean> | null | undefined,
  apiDme: boolean | undefined,
): number | null {
  const ffFallback = fundusFindingsFallback(fundusFindings);
  if (typeof ffFallback.dme === "number") return ffFallback.dme;

  if (fa) {
    const he = fa.hard_exudates;
    const mac = fa.macula;
    const dmeI = fa.dme_indirect;
    const hePres = isRecord(he) ? presence01(he.presence) : null;
    const nearMac =
      (isRecord(mac) ? optBool01(mac.hard_exudates_near_macula) : null) ===
        1 ||
      (isRecord(he) ? optBool01(he.near_macula) : null) === 1;
    if (nearMac && hePres === 1) return 1;
    if (isRecord(mac) && optBool01(mac.edema_suspected_clinical) === 1) {
      return 1;
    }
    if (isRecord(dmeI) && optBool01(dmeI.inferred_from_fundus) === 1) {
      return 1;
    }
    if (hePres === 0 && optBool01(isRecord(mac) ? mac.hard_exudates_near_macula : null) === 0) {
      if (apiDme !== true) return 0;
    }
  }

  if (apiDme === true) return 1;
  if (apiDme === false) return 0;
  if (fundusFindings?.macular_edema_suspected === true) return 1;
  return null;
}

export function computeTrainingDatasetEntryFeatureColumns(params: {
  doctorNotesCombinedText: string;
  parsedInference: AiInferenceSnapshot | null;
  doctorStructuredReview: Record<string, unknown> | null | undefined;
}): TrainingEntryMlColumns {
  const notesGrade = parseDrGradeFromDoctorNotesText(
    params.doctorNotesCombinedText,
  );

  const mergedFa = mergeFundusAssessments(
    isRecord(params.parsedInference?.fundusAssessment)
      ? params.parsedInference!.fundusAssessment!
      : null,
    params.doctorStructuredReview ?? null,
  );

  const ff = params.parsedInference?.fundusFindings ?? null;
  const fb = fundusFindingsFallback(ff);

  const micro =
    microaneurysmCountLevelFromFa(mergedFa) ?? fb.microaneurysmCountLevel ?? null;
  const hemo = hemorrhageQuadrantsFromFa(mergedFa) ?? fb.hemorrhageQuadrants ?? null;
  const hexMac = hardExudateMaculaFromFa(mergedFa) ?? fb.hardExudateMacula ?? null;
  const cws = lesionPresence01(mergedFa, "cotton_wool_spots") ?? fb.cottonWoolSpots ?? null;
  const vb = lesionPresence01(mergedFa, "venous_beading") ?? fb.venousBeading ?? null;
  const ir = lesionPresence01(mergedFa, "irma") ?? fb.irma ?? null;
  const nv = nvFromFa(mergedFa) ?? fb.neovascularization ?? null;

  const trainingDme = computeTrainingDmeSuspected(
    mergedFa,
    ff,
    params.parsedInference?.dmeSuspected,
  );

  return {
    doctorNotesDerivedDrGradeInt: notesGrade,
    microaneurysmCountLevel: micro,
    hemorrhageQuadrants: hemo,
    hardExudateMacula: hexMac,
    cottonWoolSpots: cws,
    venousBeading: vb,
    irma: ir,
    neovascularization: nv,
    trainingDmeSuspected: trainingDme,
  };
}
