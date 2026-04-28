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
