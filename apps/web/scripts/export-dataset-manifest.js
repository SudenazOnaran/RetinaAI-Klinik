/* eslint-disable no-console */
/**
 * Analysis + object storage -> egitim paketi: images/ + heatmaps/ + samples.jsonl + manifest.json
 *
 *   cd retina_ai/apps/web
 *   node scripts/export-dataset-manifest.js
 *   node scripts/export-dataset-manifest.js --anonymize
 *
 * Anonimlestirme: ham patientId disa yazilmaz; patient_key = SHA256(patientId + EXPORT_PATIENT_SALT).
 * Uretimde EXPORT_PATIENT_SALT gizli tutulmali; ayni tuz ile tekrarlanabilir hash uretir.
 */
const { PrismaClient } = require("@prisma/client");
const path = require("node:path");
const fs = require("node:fs/promises");
const crypto = require("node:crypto");
const { execSync } = require("node:child_process");
const { getDrGradeFromStoredLabel } = require("./lib/dr-grade-from-stored-label.cjs");
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
  const salt =
    process.env.EXPORT_PATIENT_SALT ||
    (anonymize
      ? `ephemeral-${Date.now()}-${crypto.randomBytes(8).toString("hex")}`
      : "");

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const exportName = `dataset-${stamp}`;
  const outDir = path.join(cwd, "exports", exportName);
  const imagesDir = path.join(outDir, "images");
  const heatmapsDir = path.join(outDir, "heatmaps");

  const rows = await prisma.analysis.findMany({
    where: {
      originalImage: { not: null },
    },
    select: {
      id: true,
      patientId: true,
      createdAt: true,
      originalImage: true,
      heatmapUrl: true,
      aiResult: true,
      confidence: true,
      drFeedback: true,
      drGradeInt: true,
      aiInferenceJson: true,
      datasetSchemaVersion: true,
      aiOdriLabels: true,
      aiOdriConfidences: true,
    },
    orderBy: { createdAt: "asc" },
  });

  await fs.mkdir(imagesDir, { recursive: true });
  await fs.mkdir(heatmapsDir, { recursive: true });

  const manifest = {
    createdAt: new Date().toISOString(),
    exportDir: outDir,
    schema_version: "1",
    anonymize,
    patientSaltHint: anonymize
      ? salt.startsWith("ephemeral-")
        ? "random_per_run_set_EXPORT_PATIENT_SALT_for_reproducible_keys"
        : "from_EXPORT_PATIENT_SALT"
      : "none",
    totalRows: rows.length,
    exportedSamples: 0,
    skipped: [],
  };

  let lineCount = 0;
  const jsonlPath = path.join(outDir, "samples.jsonl");
  const jsonlChunks = [];

  for (const row of rows) {
    const url = row.originalImage;
    if (!url || !String(url).trim()) continue;

    const abs = urlToAbsoluteStoragePath(cwd, url);
    if (!abs) {
      manifest.skipped.push({
        analysisId: row.id,
        reason: "originalImage_not_object_storage_url",
      });
      continue;
    }

    try {
      await fs.access(abs);
    } catch {
      manifest.skipped.push({
        analysisId: row.id,
        reason: "original_file_missing",
        expectedPath: abs,
      });
      continue;
    }

    const ext = path.extname(abs) || ".png";
    const imageDestName = `${row.id}_original${ext}`;
    const imageRel = `images/${imageDestName}`;
    await fs.copyFile(abs, path.join(imagesDir, imageDestName));

    let heatmapRel = null;
    const hUrl = row.heatmapUrl;
    if (hUrl && String(hUrl).trim()) {
      const hAbs = urlToAbsoluteStoragePath(cwd, hUrl);
      if (hAbs) {
        try {
          await fs.access(hAbs);
          const hex = path.extname(hAbs) || ".png";
          const heatDest = `${row.id}_heatmap${hex}`;
          heatmapRel = `heatmaps/${heatDest}`;
          await fs.copyFile(hAbs, path.join(heatmapsDir, heatDest));
        } catch {
          /* heatmap yok say */
        }
      }
    }

    const inference = row.aiInferenceJson;
    const pseudoGrade =
      typeof row.drGradeInt === "number" &&
      row.drGradeInt >= 0 &&
      row.drGradeInt <= 4
        ? row.drGradeInt
        : inference &&
            typeof inference === "object" &&
            inference !== null &&
            Number.isInteger(inference.drGrade)
          ? inference.drGrade
          : null;

    const goldFromFeedback = row.drFeedback
      ? getDrGradeFromStoredLabel(row.drFeedback)
      : null;
    const goldFromAi = getDrGradeFromStoredLabel(row.aiResult);
    const goldDr =
      goldFromFeedback !== null ? goldFromFeedback : goldFromAi;

    const recommendedTrainingGrade =
      goldFromFeedback !== null
        ? goldFromFeedback
        : pseudoGrade !== null
          ? pseudoGrade
          : goldDr;

    const sample = {
      schema_version: "1",
      sample_id: row.id,
      created_at: row.createdAt.toISOString(),
      analysis_id: row.id,
      image_relative_path: imageRel,
      heatmap_relative_path: heatmapRel,
      pseudo_dr_grade_int: pseudoGrade,
      recommended_training_grade: recommendedTrainingGrade,
      fundus_findings:
        inference &&
        typeof inference === "object" &&
        inference !== null &&
        inference.fundusFindings
          ? inference.fundusFindings
          : undefined,
      dme_suspected:
        inference &&
        typeof inference === "object" &&
        inference !== null &&
        typeof inference.dmeSuspected === "boolean"
          ? inference.dmeSuspected
          : undefined,
      dme_confidence:
        inference &&
        typeof inference === "object" &&
        inference !== null &&
        typeof inference.dmeConfidence === "number"
          ? inference.dmeConfidence
          : undefined,
      clinical_decision:
        inference &&
        typeof inference === "object" &&
        inference !== null &&
        inference.clinicalDecision
          ? inference.clinicalDecision
          : undefined,
      uncertainty_note:
        inference &&
        typeof inference === "object" &&
        inference !== null &&
        typeof inference.uncertaintyNote === "string"
          ? inference.uncertaintyNote
          : undefined,
      llm_meta:
        inference &&
        typeof inference === "object" &&
        inference !== null &&
        inference.inference
          ? inference.inference
          : undefined,
      pseudo_label: inference || undefined,
      human_label: {
        ai_result_stored: row.aiResult,
        dr_feedback_stored: row.drFeedback,
        gold_dr_grade_int: goldDr,
        verified_by_feedback: Boolean(
          row.drFeedback && String(row.drFeedback).trim(),
        ),
      },
      odir: {
        labelsJson: row.aiOdriLabels,
        confidencesJson: row.aiOdriConfidences,
      },
      dataset_schema_version_row: row.datasetSchemaVersion || "1",
    };

    if (anonymize) {
      sample.patient_id_anonymized = patientKey(row.patientId, salt);
    } else {
      sample.patient_id = row.patientId;
    }

    jsonlChunks.push(JSON.stringify(sample));
    lineCount++;
  }

  await fs.writeFile(jsonlPath, jsonlChunks.join("\n") + (lineCount ? "\n" : ""), "utf8");
  manifest.exportedSamples = lineCount;

  await fs.writeFile(
    path.join(outDir, "manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf8",
  );

  console.log(
    JSON.stringify(
      {
        message: "export_dataset_manifest_done",
        outDir,
        samples: lineCount,
        skipped: manifest.skipped.length,
      },
      null,
      2,
    ),
  );

  const tarPath = `${outDir}.tar.gz`;
  try {
    execSync(
      `tar czf "${tarPath}" -C "${path.join(cwd, "exports")}" "${exportName}"`,
      { stdio: "inherit" },
    );
    console.log(JSON.stringify({ tarCreated: tarPath }, null, 2));
  } catch {
    console.warn(
      "tar komutu calismadi (Windows veya tar yok). Klasoru manuel sikistirin:",
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
