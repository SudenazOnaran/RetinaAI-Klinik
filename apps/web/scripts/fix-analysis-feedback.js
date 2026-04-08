/* eslint-disable no-console */
const { PrismaClient } = require("@prisma/client");
require("dotenv").config();

const prisma = new PrismaClient();

const VALID_LABELS = new Set([
  "no_dr",
  "mild",
  "moderate",
  "severe",
  "proliferative_dr",
]);

function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function toCanonicalLabel(value) {
  const key = normalize(value);

  if (!key) return null;
  if (VALID_LABELS.has(key)) return key;
  if (key === "proliferative" || key === "proliferatif")
    return "proliferative_dr";
  if (key === "yok") return "no_dr";
  if (key === "hafif") return "mild";
  if (key === "orta") return "moderate";
  if (key === "ciddi") return "severe";

  return null;
}

async function main() {
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
  const touchedPatients = new Set();

  for (const analysis of analyses) {
    const canonicalFeedback = toCanonicalLabel(analysis.drFeedback);

    if (analysis.drFeedback && !canonicalFeedback) {
      await prisma.analysis.update({
        where: { id: analysis.id },
        data: { drFeedback: null },
      });
      cleanedFeedbackCount += 1;
      touchedPatients.add(analysis.patientId);
      continue;
    }

    if (
      analysis.drFeedback &&
      canonicalFeedback &&
      normalize(analysis.drFeedback) !== canonicalFeedback
    ) {
      await prisma.analysis.update({
        where: { id: analysis.id },
        data: { drFeedback: canonicalFeedback },
      });
      touchedPatients.add(analysis.patientId);
    }

    const canonicalAi = toCanonicalLabel(analysis.aiResult);
    if (canonicalAi && normalize(analysis.aiResult) !== canonicalAi) {
      await prisma.analysis.update({
        where: { id: analysis.id },
        data: { aiResult: canonicalAi },
      });
      touchedPatients.add(analysis.patientId);
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

    const finalCanonical =
      toCanonicalLabel(latest.drFeedback) ||
      toCanonicalLabel(latest.aiResult) ||
      "no_dr";

    const riskValueMap = {
      no_dr: "No_DR",
      mild: "Mild",
      moderate: "Moderate",
      severe: "Severe",
      proliferative_dr: "Proliferative_DR",
    };

    const nextRisk = riskValueMap[finalCanonical];

    await prisma.patient.update({
      where: { id: patient.id },
      data: { risk: nextRisk },
    });
    updatedPatientRiskCount += 1;
  }

  console.log("Feedback cleanup completed.");
  console.log(`- Cleaned invalid drFeedback rows: ${cleanedFeedbackCount}`);
  console.log(`- Patients with recomputed risk: ${updatedPatientRiskCount}`);
  console.log(`- Patients touched during cleanup: ${touchedPatients.size}`);
}

main()
  .catch((err) => {
    console.error("Cleanup failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
