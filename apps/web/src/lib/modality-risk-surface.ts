type OctLike = { conditions?: { likelihood: string; name: string }[] } | null;
type FfaLike = { diseases?: { likelihood: string; name: string }[] } | null;
type OctCond = { name: string; likelihood: string };
type FfaDis = { name: string; likelihood: string };

const ELEVATED = new Set(["high", "moderate"]);

/**
 * Fundus’taki yüksek risk vurgusuna benzer: herhangi bir AI koşul/hastalık olasılığı
 * orta veya yüksek ise özet + detay ayrımı gösterilir.
 */
export function octSurfaceRiskFromPayload(result: OctLike): boolean {
  if (!result) return false;
  if (result.conditions?.some((c) => isElevatedLikelihood(c.likelihood))) {
    return true;
  }
  return false;
}

/**
 * FFA: hastalık satırlarında orta/yüksek olasılık.
 */
export function ffaSurfaceRiskFromPayload(result: FfaLike): boolean {
  if (!result) return false;
  if (result.diseases?.some((d) => isElevatedLikelihood(d.likelihood))) {
    return true;
  }
  return false;
}

function isElevatedLikelihood(
  raw: string | null | undefined,
): boolean {
  const x = String(raw || "")
    .trim()
    .toLowerCase();
  return ELEVATED.has(x);
}

/** Koşul adı eşleştirmede kullanılır (AI dilinden bağımsız) */
function normalizeDiseaseName(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[ıi]/g, "i");
}

/**
 * Mevcut AI koşul listesini sabit butonlara eşle: varsa o satırdan olasılık badge’i alınır.
 */
export function mergeOctStaticWithAiConditions(
  staticKeys: readonly { value: string; match: readonly string[] }[],
  conditions: OctCond[] | undefined,
): Array<{
  value: string;
  valueKey: string;
  aiMatchedName?: string;
  likelihood?: string;
}> {
  const byToken = new Map<string, { likelihood: string; name: string }>();
  for (const c of conditions || []) {
    const name = String(c.name || "").trim();
    if (!name) continue;
    const n = normalizeDiseaseName(name);
    for (const { value, match } of staticKeys) {
      if (match.some((m) => n.includes(m) || m.includes(n))) {
        if (!byToken.has(value)) {
          byToken.set(value, { likelihood: c.likelihood, name });
        }
        break;
      }
    }
  }
  return staticKeys.map(({ value }) => {
    const found = byToken.get(value);
    return {
      value,
      valueKey: value,
      aiMatchedName: found?.name,
      likelihood: found?.likelihood,
    };
  });
}

export const OCT_DISAGREE_MATCH = [
  { value: "oct_dme", match: ["dme", "diabetik", "edema", "ödem"] as const },
  { value: "oct_amd", match: ["amd", "dejener", "yşa", "macular degeneration", "neovas"] as const },
  { value: "oct_macular_hole", match: ["hole", "delik", "macular hole", "makula delik"] as const },
  { value: "oct_erm", match: ["erm", "vmt", "vitreo", "epiretinal", "yapış", "traksiyon"] as const },
] as const;

export const OCT_HEALTHY_VALUE = "oct_saglikli_makula";

/** Doktor düzeltmesinde «anjiyografide belirgin patoloji yok» — AI eşlemesi yok. */
export const FFA_HEALTHY_VALUE = "ffa_healthy" as const;

export const FFA_DISEASE_KEYS = [
  {
    value: FFA_HEALTHY_VALUE,
    match: [] as readonly string[],
  },
  { value: "ffa_dr", match: ["diabet", "retinopati", "npdr", "pdr", "dr", "dme"] as const },
  { value: "ffa_rvo", match: ["rvo", "ven", "tıkan", "branch", "crao", "occlusion"] as const },
  { value: "ffa_amd_cnv", match: ["amd", "cnv", "neovas", "koroidal", "macula"] as const },
  { value: "ffa_csr", match: ["csr", "seröz", "santral seröz", "cscr"] as const },
  { value: "ffa_uveitis", match: ["üveit", "uveit", "vaskülit", "retinal vask", "vaskulit"] as const },
] as const;

/**
 * FFA: AI hastalık adlarından eşleşmeyi bul.
 */
export function mergeFfaStaticWithDiseases(
  staticKeys: typeof FFA_DISEASE_KEYS,
  diseases: FfaDis[] | undefined,
): Array<{
  value: string;
  valueKey: string;
  aiMatchedName?: string;
  likelihood?: string;
}> {
  const byToken = new Map<string, { likelihood: string; name: string }>();
  for (const c of diseases || []) {
    const name = String(c.name || "").trim();
    if (!name) continue;
    const n = normalizeDiseaseName(name);
    for (const { value, match } of staticKeys) {
      if (match.some((m) => n.includes(m))) {
        if (!byToken.has(value)) {
          byToken.set(value, { likelihood: c.likelihood, name });
        }
        break;
      }
    }
  }
  return staticKeys.map(({ value }) => {
    const found = byToken.get(value);
    return {
      value,
      valueKey: value,
      aiMatchedName: found?.name,
      likelihood: found?.likelihood,
    };
  });
}

type AnteriorSegmentDis = {
  disease: string;
  status: string;
  confidence: number;
};

const ANTERIOR_ELEVATED = new Set(["present", "possibly_present"]);

export function anteriorSegmentSurfaceRiskFromPayload(
  result: { diseaseAssessment?: AnteriorSegmentDis[] } | null,
): boolean {
  if (!result) return false;
  return (
    result.diseaseAssessment?.some((d) =>
      ANTERIOR_ELEVATED.has(String(d.status || "").trim().toLowerCase()),
    ) ?? false
  );
}

export const ANTERIOR_SEGMENT_HEALTHY_VALUE = "as_healthy" as const;

export const ANTERIOR_SEGMENT_DISEASE_KEYS = [
  { value: ANTERIOR_SEGMENT_HEALTHY_VALUE, match: [] as readonly string[] },
  {
    value: "as_conjunctivitis",
    match: ["conjunctivitis", "konjonktivit"] as const,
  },
  { value: "as_blepharitis", match: ["blepharitis", "blefarit"] as const },
  {
    value: "as_hordeolum",
    match: ["hordeolum", "stye", "hordeol", "arpacik", "arpacık"] as const,
  },
  { value: "as_chalazion", match: ["chalazion", "şalazyon", "salazyon"] as const },
  { value: "as_pterygium", match: ["pterygium", "pterjiyum"] as const },
  {
    value: "as_subconjunctival_hemorrhage",
    match: ["subconjunctival", "hemorrhage", "kanama", "subkonjon"] as const,
  },
  { value: "as_keratitis", match: ["keratitis", "keratit"] as const },
  {
    value: "as_corneal_ulcer",
    match: ["corneal ulcer", "ulcer", "ülser", "ulser", "kornea ülser"] as const,
  },
  { value: "as_keratoconus", match: ["keratoconus", "keratokonus"] as const },
  {
    value: "as_dry_eye",
    match: ["dry eye", "kuru goz", "kuru göz", "dry eye syndrome"] as const,
  },
  {
    value: "as_allergic_conjunctivitis",
    match: ["allergic conjunctivitis", "alerjik konjonktivit", "allergic"] as const,
  },
  {
    value: "as_anterior_uveitis",
    match: ["anterior uveitis", "on uveit", "ön üveit", "uveitis", "uveit"] as const,
  },
  { value: "as_cataract", match: ["cataract", "katarakt"] as const },
  { value: "as_entropion", match: ["entropion", "entropiyon"] as const },
  { value: "as_ectropion", match: ["ectropion", "ektropiyon"] as const },
  { value: "as_pinguecula", match: ["pinguecula", "pingvekula", "pinguekula"] as const },
  {
    value: "as_corneal_scar",
    match: ["corneal scar", "kornea skar", "skar", "scar"] as const,
  },
  { value: "as_anisocoria", match: ["anisocoria", "anizokori", "anisokori"] as const },
  { value: "as_ptosis", match: ["ptosis", "ptozis"] as const },
] as const;

export function mergeAnteriorSegmentStaticWithAiDiseases(
  staticKeys: typeof ANTERIOR_SEGMENT_DISEASE_KEYS,
  diseases: AnteriorSegmentDis[] | undefined,
): Array<{
  value: string;
  valueKey: string;
  aiMatchedName?: string;
  status?: string;
  confidence?: number;
}> {
  const byToken = new Map<
    string,
    { status: string; name: string; confidence: number }
  >();
  for (const c of diseases || []) {
    const name = String(c.disease || "").trim();
    if (!name) continue;
    const n = normalizeDiseaseName(name);
    for (const { value, match } of staticKeys) {
      if (match.some((m) => n.includes(m) || m.includes(n))) {
        if (!byToken.has(value)) {
          byToken.set(value, {
            status: c.status,
            name,
            confidence: c.confidence,
          });
        }
        break;
      }
    }
  }
  return staticKeys.map(({ value }) => {
    const found = byToken.get(value);
    return {
      value,
      valueKey: value,
      aiMatchedName: found?.name,
      status: found?.status,
      confidence: found?.confidence,
    };
  });
}

export function pickHighestAnteriorSegmentDisease(
  diseases: AnteriorSegmentDis[] | undefined,
): AnteriorSegmentDis | null {
  if (!diseases?.length) return null;
  const rank = (status: string) => {
    const s = String(status || "")
      .trim()
      .toLowerCase();
    if (s === "present") return 3;
    if (s === "possibly_present") return 2;
    if (s === "limited_assessment") return 1;
    return 0;
  };
  const elevated = diseases.filter((d) => rank(d.status) >= 2);
  if (!elevated.length) return null;
  return [...elevated].sort((a, b) => {
    const r = rank(b.status) - rank(a.status);
    if (r !== 0) return r;
    return (b.confidence || 0) - (a.confidence || 0);
  })[0];
}
