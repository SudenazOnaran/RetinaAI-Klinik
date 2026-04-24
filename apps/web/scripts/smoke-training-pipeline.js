/* eslint-disable no-console */
/**
 * Pipeline duman testi: DB satir sayisi -> export -> DR egitim 1 epoch.
 *   cd apps/web && node scripts/smoke-training-pipeline.js
 */
const { execSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const { PrismaClient } = require("@prisma/client");
require("dotenv").config();

const prisma = new PrismaClient();
const webRoot = path.join(__dirname, "..");
const aiRoot = path.join(webRoot, "..", "..", "services", "ai");

async function main() {
  const n = await prisma.trainingDatasetEntry.count();
  console.log(JSON.stringify({ step: "db_count", trainingDatasetEntry: n }, null, 2));

  if (n === 0) {
    console.log(
      JSON.stringify(
        {
          outcome: "skip",
          reason:
            "TrainingDatasetEntry bos. Uygulamada fundus ile rapor kaydedin; sonra tekrar calistirin.",
        },
        null,
        2,
      ),
    );
    await prisma.$disconnect();
    return;
  }

  execSync(`node "${path.join(webRoot, "scripts", "export-training-dataset-entries.js")}"`, {
    cwd: webRoot,
    stdio: "inherit",
  });

  const exportsRoot = path.join(webRoot, "exports");
  const dirs = fs
    .readdirSync(exportsRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name.startsWith("training-dataset-"))
    .map((d) => d.name)
    .sort()
    .reverse();
  const latest = dirs[0];
  if (!latest) {
    console.error("Export klasoru bulunamadi");
    await prisma.$disconnect();
    process.exit(1);
  }
  const outDir = path.join(exportsRoot, latest);
  const jsonl = path.join(outDir, "samples.jsonl");
  const raw = fs.readFileSync(jsonl, "utf8").trim();
  const lines = raw ? raw.split("\n").filter(Boolean) : [];
  console.log(JSON.stringify({ step: "export", outDir, samples: lines.length }, null, 2));

  if (lines.length === 0) {
    console.log(
      JSON.stringify(
        {
          outcome: "partial",
          reason:
            "Export ornek yok (goruntu dosyasi eksik veya URL depo disi). Web storage altinda orijinal dosya olmali.",
        },
        null,
        2,
      ),
    );
    await prisma.$disconnect();
    return;
  }

  const trainDr = path.join(aiRoot, "training", "train_dr_classifier_mvp.py");
  if (!fs.existsSync(trainDr)) {
    console.log(JSON.stringify({ outcome: "export_only", trainScriptMissing: trainDr }, null, 2));
    await prisma.$disconnect();
    return;
  }

  try {
    execSync(
      `python "${trainDr}" --dataset "${jsonl}" --images-root "${outDir}" --epochs 1 --batch-size 2 --out "${path.join(aiRoot, "training_out", "smoke_dr.pt")}"`,
      { cwd: aiRoot, stdio: "inherit" },
    );
    console.log(
      JSON.stringify(
        {
          outcome: "ok",
          message: "DR siniflandirici 1 epoch tamamlandi (smoke).",
          weights: path.join(aiRoot, "training_out", "smoke_dr.pt"),
        },
        null,
        2,
      ),
    );
  } catch {
    console.log(
      JSON.stringify(
        {
          outcome: "train_failed",
          hint: "Python/torch, CUDA veya goruntu yollarini kontrol edin.",
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
