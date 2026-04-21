/* eslint-disable no-console */
/**
 * Eski kısa kodları ve İngilizce ayrıntılı etiketleri, `services/ai/app.py`
 * ile aynı sıradaki Türkçe ayrıntılı etiketlere dönüştürür.
 *
 * Çalıştırma: node scripts/fix-analysis-feedback.js
 * (apps/web dizininden, .env yüklü olmalı)
 */
const { PrismaClient } = require("@prisma/client");
require("dotenv").config();

const prisma = new PrismaClient();

const DR_STAGE_LABELS_TR = [
  "Evre 0 (Sağlıklı - No DR)",
  "Evre 1 (Hafif - Mild NPDR)  ",
  "Evre 2 (Orta - Moderate NPDR) ",
  "Evre 3 (Şiddetli - Severe NPDR):",
  "Evre 4 (Proliferatif - PDR)",
];

const DR_STAGE_LABELS_EN = [
  "Stage 0 (Healthy - No DR)",
  "Stage 1 (Mild NPDR)",
  "Stage 2 (Moderate NPDR)",
  "Stage 3 (Severe NPDR)",
  "Stage 4 (Proliferative PDR)",
];

function normalizeRiskKey(value) {
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

function getDrStageIndexFromLabel(value) {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  for (let i = 0; i < DR_STAGE_LABELS_TR.length; i++) {
    const tr = DR_STAGE_LABELS_TR[i];
    if (raw === tr || raw === tr.trim()) return i;
  }
  for (let i = 0; i < DR_STAGE_LABELS_EN.length; i++) {
    const en = DR_STAGE_LABELS_EN[i];
    if (raw === en || raw === en.trim()) return i;
  }

  const key = normalizeRiskKey(raw);

  if (
    ["no_dr", "no.dr", "healthy", "saglikli", "yok", "none", "normal"].includes(
      key,
    )
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

async function main() {
  const targetLocale = (process.env.FIX_DR_LABEL_LOCALE || "tr")
    .trim()
    .toLowerCase();
  const useEnglish =
    targetLocale === "en" || targetLocale === "english";

  const toStored = (value) => {
    const idx = getDrStageIndexFromLabel(value);
    if (idx === null) return null;
    return useEnglish ? DR_STAGE_LABELS_EN[idx] : DR_STAGE_LABELS_TR[idx];
  };

  const analyses = await prisma.analysis.findMany({
    select: {
      id: true,
      patientId: true,
      createdAt: true,
      aiResult: true,
      drFeedback: true,
    },
    orderBy: { createdAt: "desc" },
  });

  let cleanedFeedbackCount = 0;
  let updatedFeedbackCount = 0;
  let updatedAiCount = 0;
  const touchedPatients = new Set();

  for (const analysis of analyses) {
    if (analysis.drFeedback) {
      const stored = toStored(analysis.drFeedback);
      if (!stored) {
        await prisma.analysis.update({
          where: { id: analysis.id },
          data: { drFeedback: null },
        });
        cleanedFeedbackCount += 1;
        touchedPatients.add(analysis.patientId);
        continue;
      }
      if (analysis.drFeedback !== stored) {
        await prisma.analysis.update({
          where: { id: analysis.id },
          data: { drFeedback: stored },
        });
        updatedFeedbackCount += 1;
        touchedPatients.add(analysis.patientId);
      }
    }

    if (analysis.aiResult) {
      const stored = toStored(analysis.aiResult);
      if (stored && analysis.aiResult !== stored) {
        await prisma.analysis.update({
          where: { id: analysis.id },
          data: { aiResult: stored },
        });
        updatedAiCount += 1;
        touchedPatients.add(analysis.patientId);
      }
    }
  }

  const patients = await prisma.patient.findMany({
    select: {
      id: true,
      analyses: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { aiResult: true, drFeedback: true },
      },
    },
  });

  let updatedPatientRiskCount = 0;

  for (const patient of patients) {
    const latest = patient.analyses[0];
    if (!latest) continue;

    const raw =
      latest.drFeedback || latest.aiResult || "Evre 0 (Sağlıklı - No DR)";
    const nextRisk = toStored(raw);
    if (!nextRisk) continue;

    await prisma.patient.update({
      where: { id: patient.id },
      data: { risk: nextRisk },
    });
    updatedPatientRiskCount += 1;
  }

  console.log("DR etiket düzeltmesi tamamlandı.");
  console.log(`- Hedef dil: ${useEnglish ? "en (Stage …)" : "tr (Evre …)"}`);
  console.log(`- Geçersiz drFeedback temizlenen satır: ${cleanedFeedbackCount}`);
  console.log(`- Güncellenen drFeedback: ${updatedFeedbackCount}`);
  console.log(`- Güncellenen aiResult: ${updatedAiCount}`);
  console.log(`- risk alanı yenilenen hasta: ${updatedPatientRiskCount}`);
  console.log(`- Dokunulan hasta (analiz): ${touchedPatients.size}`);
}

main()
  .catch((err) => {
    console.error("Cleanup failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
