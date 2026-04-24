/**
 * Eski TrainingDatasetEntry satirlarinda inferenceSnapshotJson'u training_snapshot_v2 yapar.
 *   cd apps/web && npx tsx scripts/backfill-training-snapshot-v2.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { parseClientInferenceSnapshot } from "../src/lib/dataset/snapshot";
import { buildTrainingInferenceSnapshotV2 } from "../src/lib/dataset/training-snapshot-v2";
import {
  computeTrainingLabelQuality,
  resolveGoldDrGradeInt,
} from "../src/lib/dataset/training-labels";
import { resolveDrLabelToStoredForm } from "../src/lib/dr-stage-labels";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.trainingDatasetEntry.findMany({
    select: { id: true, analysisId: true, inferenceSnapshotJson: true },
  });

  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const j = row.inferenceSnapshotJson;
    if (isRecord(j) && j.version === "training_snapshot_v2") {
      skipped += 1;
      continue;
    }

    const a = await prisma.analysis.findUnique({
      where: { id: row.analysisId },
      select: {
        aiInferenceJson: true,
        aiResult: true,
        drFeedback: true,
        confidence: true,
        drGradeInt: true,
        physicianClinicalReasoning: true,
        doctorStructuredReview: true,
      },
    });
    if (!a) continue;

    const resolvedAi =
      resolveDrLabelToStoredForm(a.aiResult, "tr") ?? a.aiResult;
    const parsed = parseClientInferenceSnapshot(a.aiInferenceJson);
    const rawFb = a.drFeedback?.trim() || "";
    const resolvedFeedback = rawFb
      ? resolveDrLabelToStoredForm(rawFb, "tr") ?? rawFb
      : null;

    const goldDrGradeInt = resolveGoldDrGradeInt({
      feedbackStored: resolvedFeedback ?? undefined,
      inferenceDrGrade: parsed?.drGrade ?? null,
      aiResultStored: resolvedAi,
    });

    const docRev = a.doctorStructuredReview;
    const doctorReviewRecord =
      docRev && isRecord(docRev) ? docRev : null;

    const labelQuality = computeTrainingLabelQuality({
      hasDrFeedback: Boolean(resolvedFeedback),
      physicianReasoning: a.physicianClinicalReasoning,
      doctorStructuredReview: doctorReviewRecord ?? undefined,
    });

    const trainingSnapshotJson = buildTrainingInferenceSnapshotV2({
      parsed,
      resolvedAi,
      goldDrGradeInt,
      labelQuality,
      confidence: a.confidence,
    });

    await prisma.trainingDatasetEntry.update({
      where: { id: row.id },
      data: {
        inferenceSnapshotJson: trainingSnapshotJson,
        drFeedback: rawFb ? resolvedFeedback ?? rawFb : null,
      },
    });
    updated += 1;
  }

  console.log(
    JSON.stringify(
      {
        message: "backfill_training_snapshot_v2_done",
        total: rows.length,
        updated,
        already_v2: skipped,
      },
      null,
      2,
    ),
  );
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
