import type { Locale } from "@/lib/i18n/config";

/** `services/ai/app.py` içindeki `PT_CLASS_NAMES` ile aynı sırada olmalı (sınıf indeksi 0..4). */
export const DR_STAGE_LABELS_TR = [
  "Evre 0 (Sağlıklı - No DR)",
  "Evre 1 (Hafif - Mild NPDR)  ",
  "Evre 2 (Orta - Moderate NPDR) ",
  "Evre 3 (Şiddetli - Severe NPDR):",
  "Evre 4 (Proliferatif - PDR)",
] as const;

/** İngilizce arayüz / kayıt için paralel ayrıntılı etiketler. */
export const DR_STAGE_LABELS_EN = [
  "Stage 0 (Healthy - No DR)",
  "Stage 1 (Mild NPDR)",
  "Stage 2 (Moderate NPDR)",
  "Stage 3 (Severe NPDR)",
  "Stage 4 (Proliferative PDR)",
] as const;

export type DrStageIndex = 0 | 1 | 2 | 3 | 4;

export function normalizeRiskKey(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u");
}

/** Ham metin, TR/EN ayrıntılı etiket veya eski kısa kodlardan evre indeksini çözer. */
export function getDrStageIndexFromLabel(
  value: string | null | undefined,
): DrStageIndex | null {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  for (let i = 0; i < DR_STAGE_LABELS_TR.length; i++) {
    const tr = DR_STAGE_LABELS_TR[i];
    if (raw === tr || raw === tr.trim()) return i as DrStageIndex;
  }
  for (let i = 0; i < DR_STAGE_LABELS_EN.length; i++) {
    const en = DR_STAGE_LABELS_EN[i];
    if (raw === en || raw === en.trim()) return i as DrStageIndex;
  }

  const key = normalizeRiskKey(raw);

  /* "yok" burada yok: eksik veri yer tutucusu ile karışıyordu; DR yok için no_dr / Evre 0 kullanılmalı. */
  if (
    ["no_dr", "no.dr", "healthy", "saglikli", "none", "normal"].includes(key)
  ) {
    return 0;
  }
  if (["mild", "hafif", "hafif_evre", "dusuk_risk"].includes(key)) return 1;
  if (
    ["moderate", "orta", "orta_evre", "orta_risk", "medium"].includes(key)
  ) {
    return 2;
  }
  if (
    [
      "severe",
      "agir",
      "agir_evre",
      "agir_risk",
      "yuksek_risk",
      "high_risk",
      "high",
      "ciddi",
    ].includes(key)
  ) {
    return 3;
  }
  if (
    [
      "proliferative_dr",
      "proliferative",
      "proliferatif",
      "kritik_risk",
      "cok_ileri_evre",
    ].includes(key)
  ) {
    return 4;
  }

  if (key.includes("evre_4") || key.includes("stage_4")) return 4;

  /* Evre/Stage öneki olmadan gelen PDR veya İngilizce proliferative (SQL'de sadece proliferatif aranıyordu). */
  const isNonProliferative =
    /nonproliferatif|nonproliferative|non_proliferatif|non_proliferative/.test(
      key,
    );
  if (
    !isNonProliferative &&
    (key.includes("proliferatif") || key.includes("proliferative"))
  ) {
    return 4;
  }

  if (key.includes("evre_3") || key.includes("stage_3")) return 3;
  if (key.includes("evre_2") || key.includes("stage_2")) return 2;
  /* evre_10 / stage_10 yanlışlıkla evre_1 / stage_1 sayılmasın */
  if (
    /(^|_)evre_1([^0-9]|$)/.test(key) ||
    /(^|_)stage_1([^0-9]|$)/.test(key)
  ) {
    return 1;
  }
  if (
    /(^|_)evre_0([^0-9]|$)/.test(key) ||
    /(^|_)stage_0([^0-9]|$)/.test(key)
  ) {
    return 0;
  }

  return null;
}

export function getStorageDrLabel(
  index: DrStageIndex,
  locale: Locale,
): string {
  return locale === "tr"
    ? DR_STAGE_LABELS_TR[index]
    : DR_STAGE_LABELS_EN[index];
}

/** Kayıt için: herhangi bir girdiyi istenen dildeki ayrıntılı etikete çevirir. */
export function resolveDrLabelToStoredForm(
  value: string | null | undefined,
  locale: Locale,
): string | null {
  const idx = getDrStageIndexFromLabel(value);
  if (idx === null) return null;
  return getStorageDrLabel(idx, locale);
}

/** Arayüzde gösterim: depodaki TR veya EN ayrıntılı / eski kodları mevcut dile çevirir. */
export function formatDrLabelForDisplay(
  value: string | null | undefined,
  locale: Locale,
): string {
  const idx = getDrStageIndexFromLabel(value);
  if (idx === null) {
    const s = String(value ?? "").trim();
    return s || (locale === "en" ? "Not specified" : "Belirtilmedi");
  }
  const label = getStorageDrLabel(idx, locale);
  return label.trim();
}
