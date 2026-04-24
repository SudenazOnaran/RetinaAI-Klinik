/* eslint-disable no-console */
/**
 * TrainingDatasetEntry + Analysis join: goruntu/snapshot satirdan; heatmap, komorbidite, doktor alanlari Analysis'ten.
 * JSONL + isteğe bağlı CSV; goruntuler images/ heatmaps/
 *
 *   node scripts/export-training-dataset-entries.js
 *   node scripts/export-training-dataset-entries.js --anonymize
 *   node scripts/export-training-dataset-entries.js --csv
 *   node scripts/export-training-dataset-entries.js --ml-slim
 *       (yalnizca egıtim hedefleri + goruntu yolu; ID/heatmap/meta yok; hasta gruplama icin patient_bucket)
 *
 * Eski snapshot: npx tsx scripts/backfill-training-snapshot-v2.ts
 */
const { PrismaClient } = require("@prisma/client");
const path = require("node:path");
const fs = require("node:fs/promises");
const crypto = require("node:crypto");
const { execSync } = require("node:child_process");
const { getDrGradeFromStoredLabel } = require("./lib/dr-grade-from-stored-label.cjs");
const {
  extractInferenceForExport,
} = require("./lib/export-sample-inference.cjs");
const { csvEscape } = require("./lib/csv-escape.cjs");
require("dotenv").config();

const prisma = new PrismaClient();
const URL_PREFIX = "/api/storage/object/";

function urlToAbsoluteStoragePath(cwd, url) {
  if (!url || typeof url !== "string") return null;
  const u = url.trim();
  if (!u.startsWith(URL_PREFIX)) return null;
  const rel = u.slice(URL_PREFIX.length).replace(/^\/+/, "");
  if (!rel || rel.includes("..")) return null;
  const objectsDir = path.join(cwd, "storage", "objects");
  const full = path.normalize(path.join(objectsDir, ...rel.split("/")));
  if (!full.startsWith(objectsDir)) return null;
  return full;
}

function patientKey(patientId, salt) {
  return crypto
    .createHash("sha256")
    .update(String(patientId), "utf8")
    .update("\0", "utf8")
    .update(String(salt || ""), "utf8")
    .digest("hex")
    .slice(0, 32);
}

async function main() {
  const cwd = process.cwd();
  const anonymize = process.argv.includes("--anonymize");
  const writeCsv = process.argv.includes("--csv");
  const mlSlim = process.argv.includes("--ml-slim");
  const salt =
    process.env.EXPORT_PATIENT_SALT ||
    (anonymize || mlSlim
      ? `ephemeral-${Date.now()}-${crypto.randomBytes(8).toString("hex")}`
      : "");

  if (mlSlim && !process.env.EXPORT_PATIENT_SALT) {
    console.warn(
      JSON.stringify(
        {
          warning:
            "--ml-slim: EXPORT_PATIENT_SALT yok; patient_bucket her exportta farkli olur. " +
            "Tekrarlanabilir hasta split icin .env de sabit tuz kullanin.",
        },
        null,
        2,
      ),
    );
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const exportName = `training-dataset-${stamp}`;
  const outDir = path.join(cwd, "exports", exportName);
  const imagesDir = path.join(outDir, "images");
  const heatmapsDir = path.join(outDir, "heatmaps");

  const rows = await prisma.trainingDatasetEntry.findMany({
    orderBy: { analysis: { createdAt: "asc" } },
    include: {
      analysis: {
        select: {
          patientId: true,
          aiResult: true,
          heatmapUrl: true,
          aiInferenceJson: true,
          doctorStructuredReview: true,
          physicianClinicalReasoning: true,
          comorbidityJson: true,
          uncertaintyScore: true,
          datasetSchemaVersion: true,
          confidence: true,
          drGradeInt: true,
          createdAt: true,
        },
      },
    },
  });

  await fs.mkdir(imagesDir, { recursive: true });
  await fs.mkdir(heatmapsDir, { recursive: true });

  const manifest = {
    createdAt: new Date().toISOString(),
    exportDir: outDir,
    source: "TrainingDatasetEntry",
    task: "full_analysis_snapshot_v1",
    schema_version: "1",
    anonymize,
    ml_slim: mlSlim,
    csv: writeCsv,
    totalRows: rows.length,
    exportedSamples: 0,
    samplesWithInferenceSnapshot: 0,
    samplesMissingInferenceSnapshot: 0,
    skipped: [],
  };

  const jsonlChunks = [];
  const csvHeader = [
    "sample_id",
    "analysis_id",
    "patient_key",
    "created_at",
    "image_relative_path",
    "heatmap_relative_path",
    "recommended_training_grade",
    "gold_dr_grade_int",
    "pseudo_dr_grade_int",
    "label_quality",
    "ai_confidence_at_save",
    "inference_snapshot_present",
    "gold_dme_suspected",
    "gold_dme_confidence",
    "dme_suspected",
    "dme_confidence",
    "uncertainty_score",
    "comorbidity_json",
    "fundus_findings_json",
    "label_ai_result",
    "label_dr_correction",
    "label_training_final_tr",
    "training_doctor_notes_tr",
    "doctor_note_manual_report_v2",
    "notes_parsed_dr_grade_int",
    "microaneurysm_count_level",
    "hemorrhage_quadrants",
    "hard_exudate_macula",
    "cotton_wool_spots",
    "venous_beading",
    "irma",
    "neovascularization",
    "training_dme_suspected",
  ].join(",");
  const csvRows = [csvHeader];

  for (const row of rows) {
    const url = row.originalImageUrl;
    const abs = urlToAbsoluteStoragePath(cwd, url);
    if (!abs) {
      manifest.skipped.push({
        id: row.id,
        reason: "originalImage_not_object_storage_url",
      });
      continue;
    }
    try {
      await fs.access(abs);
    } catch {
      manifest.skipped.push({
        id: row.id,
        reason: "original_file_missing",
        expectedPath: abs,
      });
      continue;
    }

    const fileExt = path.extname(abs) || ".png";
    const imageDestName = `${row.analysisId}_original${fileExt}`;
    const imageRel = `images/${imageDestName}`;
    await fs.copyFile(abs, path.join(imagesDir, imageDestName));

    let heatmapRel = null;
    const heatmapUrl = row.analysis?.heatmapUrl;
    if (!mlSlim && heatmapUrl) {
      const hAbs = urlToAbsoluteStoragePath(cwd, heatmapUrl);
      if (hAbs) {
        try {
          await fs.access(hAbs);
          const hex = path.extname(hAbs) || ".png";
          const heatDest = `${row.analysisId}_heatmap${hex}`;
          heatmapRel = `heatmaps/${heatDest}`;
          await fs.copyFile(hAbs, path.join(heatmapsDir, heatDest));
        } catch {
          /* yok say */
        }
      }
    }

    const an = row.analysis;
    if (!an) {
      manifest.skipped.push({
        id: row.id,
        reason: "missing_analysis_relation",
      });
      continue;
    }

    const snapshotRaw =
      row.inferenceSnapshotJson ?? an.aiInferenceJson ?? null;
    const infEx = extractInferenceForExport(snapshotRaw);
    if (infEx.inference_snapshot_present) {
      manifest.samplesWithInferenceSnapshot += 1;
    } else {
      manifest.samplesMissingInferenceSnapshot += 1;
    }

    const legacyInf = infEx.ai_inference_snapshot;
    const legacyDr = legacyInf ? Number(legacyInf.drGrade) : NaN;

    const pseudoGrade =
      infEx.training_v2?.teacher_index ??
      (Number.isInteger(legacyDr) && legacyDr >= 0 && legacyDr <= 4
        ? legacyDr
        : null) ??
      (an.drGradeInt != null && an.drGradeInt >= 0 && an.drGradeInt <= 4
        ? an.drGradeInt
        : null);

    const goldFromFeedback = row.drFeedback
      ? getDrGradeFromStoredLabel(row.drFeedback)
      : null;
    const goldFromAi = getDrGradeFromStoredLabel(an.aiResult);
    const goldDr =
      goldFromFeedback !== null ? goldFromFeedback : goldFromAi;

    const goldFromEntry =
      infEx.training_v2?.gold_index ??
      (an.drGradeInt != null && an.drGradeInt >= 0 && an.drGradeInt <= 4
        ? an.drGradeInt
        : null);

    const recommendedTrainingGrade =
      goldFromEntry !== null
        ? goldFromEntry
        : goldFromFeedback !== null
          ? goldFromFeedback
          : pseudoGrade !== null
            ? pseudoGrade
            : goldDr;

    const drCorrectionRaw =
      row.drFeedback && String(row.drFeedback).trim()
        ? String(row.drFeedback).trim()
        : "";
    const drLabelEffective = drCorrectionRaw || String(an.aiResult || "");

    const labelQualityOut = infEx.training_v2?.label_quality || "weak";
    const aiConfidenceAtSave =
      typeof infEx.training_v2?.ai_confidence_at_save === "number"
        ? infEx.training_v2.ai_confidence_at_save
        : typeof an.confidence === "number"
          ? an.confidence
          : undefined;

    const physicianTr = an.physicianClinicalReasoning || undefined;
    const doctorStructured = an.doctorStructuredReview ?? undefined;
    const analysisDatasetVer = an.datasetSchemaVersion || "1";
    const analysisConfDb =
      typeof an.confidence === "number" ? an.confidence : undefined;
    const analysisDrGradeDb =
      an.drGradeInt != null && an.drGradeInt >= 0 && an.drGradeInt <= 4
        ? an.drGradeInt
        : undefined;

    const patientBucket = patientKey(an.patientId, salt);

    const sampleFull = {
      schema_version: "1",
      task: "full_analysis_snapshot_v1",
      sample_id: row.id,
      training_entry_id: row.id,
      created_at: an.createdAt.toISOString(),
      analysis_id: row.analysisId,
      image_relative_path: imageRel,
      heatmap_relative_path: heatmapRel,
      pseudo_dr_grade_int: pseudoGrade,
      gold_dr_grade_int: goldFromEntry,
      label_quality: labelQualityOut,
      ai_confidence_at_save: aiConfidenceAtSave,
      recommended_training_grade: recommendedTrainingGrade,
      human_label: {
        ai_result_stored: an.aiResult,
        dr_feedback_stored: row.drFeedback,
        dr_label_effective_tr: drLabelEffective,
        gold_dr_grade_int: goldDr,
        verified_by_feedback: Boolean(drCorrectionRaw),
        label_quality: labelQualityOut,
      },
      analysis_dataset_schema_version: analysisDatasetVer,
      analysis_confidence_db: analysisConfDb,
      analysis_dr_grade_int_db: analysisDrGradeDb,
      physician_clinical_reasoning_tr: physicianTr,
      doctor_structured_review: doctorStructured,
      ai_inference_snapshot: infEx.ai_inference_snapshot,
      inference_snapshot_present: infEx.inference_snapshot_present,
      ...infEx.flat,
      gold_dme_suspected:
        typeof infEx.flat.dme_suspected === "boolean"
          ? infEx.flat.dme_suspected
          : undefined,
      gold_dme_confidence:
        typeof infEx.flat.dme_confidence === "number"
          ? infEx.flat.dme_confidence
          : undefined,
      comorbidity_json: an.comorbidityJson ?? undefined,
      uncertainty_score:
        typeof an.uncertaintyScore === "number"
          ? an.uncertaintyScore
          : infEx.flat.uncertainty_score,
      training_doctor_notes_tr: row.doctorNotesText ?? undefined,
      doctor_note: row.doctorNote ?? undefined,
      training_entry_ml_columns: {
        doctor_notes_derived_dr_grade_int: row.doctorNotesDerivedDrGradeInt,
        microaneurysm_count_level: row.microaneurysmCountLevel,
        hemorrhage_quadrants: row.hemorrhageQuadrants,
        hard_exudate_macula: row.hardExudateMacula,
        cotton_wool_spots: row.cottonWoolSpots,
        venous_beading: row.venousBeading,
        irma: row.irma,
        neovascularization: row.neovascularization,
        training_dme_suspected: row.trainingDmeSuspected,
      },
    };

    if (anonymize) {
      sampleFull.patient_id_anonymized = patientBucket;
    } else {
      sampleFull.patient_id = an.patientId;
    }

    const uncForRow =
      typeof an.uncertaintyScore === "number"
        ? an.uncertaintyScore
        : infEx.flat.uncertainty_score;

    const sample = mlSlim
      ? {
          schema_version: "1",
          task: "ml_slim_v1",
          patient_bucket: patientBucket,
          image_relative_path: imageRel,
          recommended_training_grade: recommendedTrainingGrade,
          final_dr_label_tr: drLabelEffective,
          dr_correction_only_tr: drCorrectionRaw || undefined,
          label_quality: labelQualityOut,
          fundus_findings: infEx.flat.fundus_findings,
          fundus_assessment: infEx.flat.fundus_assessment,
          dme_suspected: infEx.flat.dme_suspected,
          dme_confidence: infEx.flat.dme_confidence,
          gold_dme_suspected:
            typeof infEx.flat.dme_suspected === "boolean"
              ? infEx.flat.dme_suspected
              : undefined,
          gold_dme_confidence:
            typeof infEx.flat.dme_confidence === "number"
              ? infEx.flat.dme_confidence
              : undefined,
          clinical_reasoning_tr: infEx.flat.clinical_reasoning_tr,
          clinical_decision: infEx.flat.clinical_decision,
          uncertainty_note: infEx.flat.uncertainty_note,
          uncertainty_score:
            typeof uncForRow === "number" ? uncForRow : undefined,
          physician_clinical_reasoning_tr: physicianTr,
          comorbidity_json: an.comorbidityJson ?? undefined,
          notes_parsed_dr_grade_int: row.doctorNotesDerivedDrGradeInt,
          microaneurysm_count_level: row.microaneurysmCountLevel,
          hemorrhage_quadrants: row.hemorrhageQuadrants,
          hard_exudate_macula: row.hardExudateMacula,
          cotton_wool_spots: row.cottonWoolSpots,
          venous_beading: row.venousBeading,
          irma: row.irma,
          neovascularization: row.neovascularization,
          training_dme_suspected: row.trainingDmeSuspected,
          training_doctor_notes_tr: row.doctorNotesText ?? undefined,
          doctor_note: row.doctorNote ?? undefined,
        }
      : sampleFull;

    jsonlChunks.push(JSON.stringify(sample));
    manifest.exportedSamples++;

    if (writeCsv) {
      const patientKeyVal = anonymize
        ? patientKey(an.patientId, salt)
        : an.patientId;
      const fundusJson =
        infEx.flat.fundus_findings != null
          ? JSON.stringify(infEx.flat.fundus_findings)
          : "";
      const comorbidityStr =
        an.comorbidityJson != null ? JSON.stringify(an.comorbidityJson) : "";
      const uncScore =
        typeof an.uncertaintyScore === "number"
          ? an.uncertaintyScore
          : infEx.flat.uncertainty_score;
      csvRows.push(
        [
          csvEscape(row.id),
          csvEscape(row.analysisId),
          csvEscape(patientKeyVal),
          csvEscape(an.createdAt.toISOString()),
          csvEscape(imageRel),
          csvEscape(heatmapRel || ""),
          csvEscape(recommendedTrainingGrade),
          csvEscape(goldFromEntry),
          csvEscape(pseudoGrade),
          csvEscape(labelQualityOut),
          csvEscape(
            typeof aiConfidenceAtSave === "number" ? aiConfidenceAtSave : "",
          ),
          csvEscape(infEx.inference_snapshot_present ? "1" : "0"),
          csvEscape(
            infEx.flat.dme_suspected === true
              ? "1"
              : infEx.flat.dme_suspected === false
                ? "0"
                : "",
          ),
          csvEscape(
            typeof infEx.flat.dme_confidence === "number"
              ? infEx.flat.dme_confidence
              : "",
          ),
          csvEscape(
            infEx.flat.dme_suspected === true
              ? "1"
              : infEx.flat.dme_suspected === false
                ? "0"
                : "",
          ),
          csvEscape(
            typeof infEx.flat.dme_confidence === "number"
              ? infEx.flat.dme_confidence
              : "",
          ),
          csvEscape(typeof uncScore === "number" ? uncScore : ""),
          csvEscape(comorbidityStr),
          csvEscape(fundusJson),
          csvEscape(an.aiResult),
          csvEscape(drCorrectionRaw),
          csvEscape(drLabelEffective),
          csvEscape(row.doctorNotesText ?? ""),
          csvEscape(row.doctorNote ?? ""),
          csvEscape(row.doctorNotesDerivedDrGradeInt),
          csvEscape(row.microaneurysmCountLevel),
          csvEscape(row.hemorrhageQuadrants),
          csvEscape(row.hardExudateMacula),
          csvEscape(row.cottonWoolSpots),
          csvEscape(row.venousBeading),
          csvEscape(row.irma),
          csvEscape(row.neovascularization),
          csvEscape(row.trainingDmeSuspected),
        ].join(","),
      );
    }
  }

  const jsonlPath = path.join(outDir, "samples.jsonl");
  await fs.writeFile(
    jsonlPath,
    jsonlChunks.join("\n") + (manifest.exportedSamples ? "\n" : ""),
    "utf8",
  );

  await fs.writeFile(
    path.join(outDir, "manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf8",
  );

  if (writeCsv) {
    const csvPath = path.join(outDir, "samples.csv");
    await fs.writeFile(csvPath, "\uFEFF" + csvRows.join("\n") + "\n", "utf8");
    console.log(
      JSON.stringify(
        { csvPath, dataRows: Math.max(0, csvRows.length - 1) },
        null,
        2,
      ),
    );
  }

  console.log(
    JSON.stringify(
      {
        message: "export_training_dataset_entries_done",
        outDir,
        samples: manifest.exportedSamples,
        skipped: manifest.skipped.length,
        with_inference_snapshot: manifest.samplesWithInferenceSnapshot,
        missing_inference_snapshot: manifest.samplesMissingInferenceSnapshot,
      },
      null,
      2,
    ),
  );

  if (manifest.samplesMissingInferenceSnapshot > 0) {
    console.warn(
      JSON.stringify(
        {
          warning:
            "Bazi satirlarda inferenceSnapshotJson yok (export Analysis.aiInferenceJson ile tamamlanir). " +
            "Eski DB: npm run backfill:training-snapshot-v2",
          missing_inference_snapshot: manifest.samplesMissingInferenceSnapshot,
        },
        null,
        2,
      ),
    );
  }

  const tarPath = `${outDir}.tar.gz`;
  try {
    execSync(
      `tar czf "${tarPath}" -C "${path.join(cwd, "exports")}" "${exportName}"`,
      { stdio: "inherit" },
    );
    console.log(JSON.stringify({ tarCreated: tarPath }, null, 2));
  } catch {
    console.warn(
      "tar calismadi; klasoru manuel sikistirin:",
      outDir,
    );
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
