/**
 * TrainingDatasetEntry için tablo sütunları: yalnizca doktor kaynakli alanlardan uretilir.
 * AI ciktilari egitim etiketine kaynak edilmez.
 */
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

/** Doktor structured review icindeki fundus_assessment'i dondurur. */
export function doctorOnlyFundusAssessment(
  doctorReview: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  const docFa = doctorReview
    ? doctorReview["fundusAssessment"] ?? doctorReview["fundus_assessment"]
    : undefined;
  const docRec = isRecord(docFa) ? docFa : null;
  if (!docRec) return null;
  return { ...docRec };
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
  fundusNvd: number | null;
  fundusNve: number | null;
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

function computeTrainingDmeSuspected(
  fa: Record<string, unknown> | null,
  doctorReview: Record<string, unknown> | null | undefined,
): number | null {
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
      return 0;
    }
  }
  const doctorDme = doctorReview
    ? doctorReview["dmeSuspected"] ?? doctorReview["dme_suspected"]
    : undefined;
  if (doctorDme === true) return 1;
  if (doctorDme === false) return 0;
  return null;
}

export function computeTrainingDatasetEntryFeatureColumns(params: {
  doctorNotesCombinedText: string;
  doctorStructuredReview: Record<string, unknown> | null | undefined;
}): TrainingEntryMlColumns {
  const notesGrade = parseDrGradeFromDoctorNotesText(
    params.doctorNotesCombinedText,
  );

  const mergedFa = doctorOnlyFundusAssessment(params.doctorStructuredReview ?? null);

  const micro = microaneurysmCountLevelFromFa(mergedFa);
  const hemo = hemorrhageQuadrantsFromFa(mergedFa);
  const hexMac = hardExudateMaculaFromFa(mergedFa);
  const cws = lesionPresence01(mergedFa, "cotton_wool_spots");
  const vb = lesionPresence01(mergedFa, "venous_beading");
  const ir = lesionPresence01(mergedFa, "irma");
  const nv = nvFromFa(mergedFa);
  const nvRec = mergedFa && isRecord(mergedFa.neovascularization)
    ? (mergedFa.neovascularization as Record<string, unknown>)
    : null;
  const nvd = nvRec ? optBool01(nvRec.nvd) : null;
  const nve = nvRec ? optBool01(nvRec.nve) : null;

  const trainingDme = computeTrainingDmeSuspected(
    mergedFa,
    params.doctorStructuredReview,
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
    fundusNvd: nvd,
    fundusNve: nve,
    trainingDmeSuspected: trainingDme,
  };
}
