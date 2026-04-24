/**
 * TrainingDatasetEntry ML sutunlarini Analysis + AI snapshot'tan yeniden hesaplar.
 *   cd apps/web && npx tsx scripts/backfill-training-entry-features.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { parseClientInferenceSnapshot } from "../src/lib/dataset/snapshot";
import type { AnalysisReportSectionsInput } from "../src/lib/dataset/analysis-report-sections";
import {
  buildCombinedDoctorNotesText,
  computeTrainingDatasetEntryFeatureColumns,
} from "../src/lib/dataset/training-entry-features";
import { resolveDrLabelToStoredForm } from "../src/lib/dr-stage-labels";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.trainingDatasetEntry.findMany({
    select: { id: true, analysisId: true, drFeedback: true },
  });

  let updated = 0;
  for (const row of rows) {
    const a = await prisma.analysis.findUnique({
      where: { id: row.analysisId },
      select: {
        aiResult: true,
        drFeedback: true,
        doctorNote: true,
        reportTitle: true,
        reportDateKey: true,
        reportDoctorDisplayName: true,
        sectionAnamnesis: true,
        sectionDoctorNotes: true,
        sectionClinicalAssessment: true,
        sectionExamFindings: true,
        sectionLabResults: true,
        sectionTreatmentRecommendations: true,
        aiInferenceJson: true,
        doctorStructuredReview: true,
      },
    });
    if (!a) continue;

    const sections: AnalysisReportSectionsInput = {
      reportTitle: a.reportTitle ?? "",
      reportDate: a.reportDateKey ?? "",
      doctorDisplayName: a.reportDoctorDisplayName ?? "",
      anamnesis: a.sectionAnamnesis ?? "",
      examFindings: a.sectionExamFindings ?? "",
      labResults: a.sectionLabResults ?? "",
      clinicalAssessment: a.sectionClinicalAssessment ?? "",
      treatmentRecommendations: a.sectionTreatmentRecommendations ?? "",
      doctorNotes: a.sectionDoctorNotes ?? "",
    };
    const hasAny = Object.values(sections).some((s) => String(s).trim());
    const combined = buildCombinedDoctorNotesText(
      hasAny ? sections : undefined,
      a.doctorNote ?? "",
    );
    const parsed = parseClientInferenceSnapshot(a.aiInferenceJson);
    const doc = a.doctorStructuredReview;
    const doctorReviewRecord = doc && isRecord(doc) ? doc : null;
    const ml = computeTrainingDatasetEntryFeatureColumns({
      doctorNotesCombinedText: combined,
      parsedInference: parsed,
      doctorStructuredReview: doctorReviewRecord,
    });

    const resolvedAi =
      resolveDrLabelToStoredForm(a.aiResult, "tr") ?? String(a.aiResult || "").trim();
    const trainingDrFeedback =
      row.drFeedback?.trim() ||
      a.drFeedback?.trim() ||
      resolvedAi ||
      null;

    const TRAINING_DOCTOR_NOTES_MAX = 120_000;
    const TRAINING_DOCTOR_NOTE_JSON_MAX = 500_000;
    const notesText =
      combined.trim().length > 0
        ? combined.trim().slice(0, TRAINING_DOCTOR_NOTES_MAX)
        : null;
    const noteJson =
      (a.doctorNote ?? "").trim().length > 0
        ? (a.doctorNote ?? "").trim().slice(0, TRAINING_DOCTOR_NOTE_JSON_MAX)
        : null;

    await prisma.trainingDatasetEntry.update({
      where: { id: row.id },
      data: {
        drFeedback: trainingDrFeedback,
        doctorNotesText: notesText,
        doctorNote: noteJson,
        doctorNotesDerivedDrGradeInt: ml.doctorNotesDerivedDrGradeInt,
        microaneurysmCountLevel: ml.microaneurysmCountLevel,
        hemorrhageQuadrants: ml.hemorrhageQuadrants,
        hardExudateMacula: ml.hardExudateMacula,
        cottonWoolSpots: ml.cottonWoolSpots,
        venousBeading: ml.venousBeading,
        irma: ml.irma,
        neovascularization: ml.neovascularization,
        trainingDmeSuspected: ml.trainingDmeSuspected,
      },
    });
    updated += 1;
  }

  console.log(
    JSON.stringify(
      { message: "backfill_training_entry_features_done", total: rows.length, updated },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
