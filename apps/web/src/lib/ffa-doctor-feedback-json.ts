/**
 * `Analysis.ffaDrFeedback` içinde JSON seri — teşhis(ler) + isteğe bağlı DR evresi.
 * v2: tek teşhis | v3: çoklu teşhis (dataset uyumlu).
 */
export type FfaDoctorFeedbackV2 = {
  v: 2;
  /** FFA_DISEASE_KEYS value veya genişletilmiş anahtar */
  diagnosis: string;
  /** Diyabetik retinopati seçildiğinde fundus ile aynı evre etiketi */
  drStage?: string | null;
  /** DR seciminde neovaskularizasyon bulgusu */
  nvd?: boolean | null;
  nve?: boolean | null;
};

export type FfaDoctorFeedbackV3 = {
  v: 3;
  diagnoses: string[];
  /** `ffa_dr` seçiliyse zorunlu */
  drStage?: string | null;
  /** `ffa_dr` seciminde istege bagli neovaskularizasyon bayraklari */
  nvd?: boolean | null;
  nve?: boolean | null;
};

export type FfaDoctorFeedbackParsed = FfaDoctorFeedbackV2 | FfaDoctorFeedbackV3;

const PREFIX = "ffa_json:";

export function encodeFfaDoctorFeedbackV2(payload: FfaDoctorFeedbackV2): string {
  return `${PREFIX}${JSON.stringify(payload)}`;
}

export function encodeFfaDoctorFeedbackV3(payload: FfaDoctorFeedbackV3): string {
  return `${PREFIX}${JSON.stringify(payload)}`;
}

export function tryParseFfaDoctorFeedbackV2(
  raw: string | null | undefined,
): FfaDoctorFeedbackV2 | null {
  const p = tryParseFfaDoctorFeedbackAny(raw);
  return p && p.v === 2 ? p : null;
}

/** v2 veya v3; `ffa_json:` ile başlayan geçerli yükü döndürür. */
export function tryParseFfaDoctorFeedbackAny(
  raw: string | null | undefined,
): FfaDoctorFeedbackParsed | null {
  const t = String(raw || "").trim();
  if (!t.startsWith(PREFIX)) return null;
  try {
    const o = JSON.parse(t.slice(PREFIX.length)) as Record<string, unknown>;
    if (!o || typeof o !== "object") return null;
    const ver = o.v;
    if (ver === 2 && typeof o.diagnosis === "string") {
      return o as unknown as FfaDoctorFeedbackV2;
    }
    if (
      ver === 3 &&
      Array.isArray(o.diagnoses) &&
      o.diagnoses.every((x) => typeof x === "string")
    ) {
      return o as unknown as FfaDoctorFeedbackV3;
    }
  } catch {
    return null;
  }
  return null;
}
