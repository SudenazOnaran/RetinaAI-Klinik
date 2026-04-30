/**
 * TrainingDatasetEntry doktor-kaynakli sutunlarini yeniden hesaplar.
 *   cd apps/web && npx tsx scripts/backfill-training-entry-features.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import type { AnalysisReportSectionsInput } from "../src/lib/dataset/analysis-report-sections";
import {
  buildCombinedDoctorNotesText,
  computeTrainingDatasetEntryFeatureColumns,
} from "../src/lib/dataset/training-entry-features";

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
    const doc = a.doctorStructuredReview;
    const doctorReviewRecord = doc && isRecord(doc) ? doc : null;
    const ml = computeTrainingDatasetEntryFeatureColumns({
      doctorNotesCombinedText: combined,
      doctorStructuredReview: doctorReviewRecord,
    });

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
        doctorNotesText: notesText,
        doctorNote: noteJson,
        fundusNvd: ml.fundusNvd,
        fundusNve: ml.fundusNve,
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
