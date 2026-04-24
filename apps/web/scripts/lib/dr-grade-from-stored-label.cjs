/**
 * TS `getDrStageIndexFromLabel` ile aynı depo etiketleri (export script için).
 * @param {string|null|undefined} value
 * @returns {number|null} 0..4
 */
function getDrGradeFromStoredLabel(value) {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const DR_TR = [
    "Evre 0 (Sağlıklı - No DR)",
    "Evre 1 (Hafif - Mild NPDR)  ",
    "Evre 2 (Orta - Moderate NPDR) ",
    "Evre 3 (Şiddetli - Severe NPDR):",
    "Evre 4 (Proliferatif - PDR)",
  ];
  const DR_EN = [
    "Stage 0 (Healthy - No DR)",
    "Stage 1 (Mild NPDR)",
    "Stage 2 (Moderate NPDR)",
    "Stage 3 (Severe NPDR)",
    "Stage 4 (Proliferative PDR)",
  ];

  for (let i = 0; i < DR_TR.length; i++) {
    const tr = DR_TR[i];
    if (raw === tr || raw === tr.trim()) return i;
  }
  for (let i = 0; i < DR_EN.length; i++) {
    const en = DR_EN[i];
    if (raw === en || raw === en.trim()) return i;
  }

  const key = String(raw)
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

  if (
    ["no_dr", "no.dr", "healthy", "saglikli", "none", "normal"].includes(key)
  ) {
    return 0;
  }
  if (["mild", "hafif", "hafif_evre", "dusuk_risk"].includes(key)) return 1;
  if (["moderate", "orta", "orta_evre", "orta_risk", "medium"].includes(key)) {
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

module.exports = { getDrGradeFromStoredLabel };
