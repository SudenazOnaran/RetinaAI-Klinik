/* eslint-disable no-console */
/**
 * Analysis tablosundaki tüm originalImage dosyalarını storage/objects altından
 * tek klasöre kopyalar ve isteğe bağlı .tar.gz üretir.
 *
 * Sunucuda (dosyaların olduğu makinede):
 *   cd /opt/apps/retina_ai/apps/web
 *   node scripts/archive-analysis-originals.js
 *
 * Yerelde (yalnızca DB tüneli açıksa, dosyalar yine sunucudaysa işe yaramaz):
 *   Aynı komut — kopyalama için script sunucuda çalışmalıdır.
 *
 * Çıktı: exports/originals-ISO-TIMESTAMP/ ve aynı isimde .tar.gz (tar varsa)
 */
const { PrismaClient } = require("@prisma/client");
const path = require("node:path");
const fs = require("node:fs/promises");
const { execSync } = require("node:child_process");
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

async function main() {
  const cwd = process.cwd();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const exportName = `originals-${stamp}`;
  const outDir = path.join(cwd, "exports", exportName);

  const rows = await prisma.analysis.findMany({
    where: {
      originalImage: { not: null },
    },
    select: { id: true, patientId: true, originalImage: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const manifest = {
    createdAt: new Date().toISOString(),
    exportDir: outDir,
    totalRows: rows.length,
    copied: [],
    missing: [],
    skippedUrl: [],
  };

  await fs.mkdir(outDir, { recursive: true });

  const seenSrc = new Set();

  for (const row of rows) {
    const url = row.originalImage;
    if (!url || !String(url).trim()) continue;

    const abs = urlToAbsoluteStoragePath(cwd, url);
    if (!abs) {
      manifest.skippedUrl.push({
        analysisId: row.id,
        patientId: row.patientId,
        originalImage: url,
        reason: "not_object_storage_url_or_invalid",
      });
      continue;
    }

    if (seenSrc.has(abs)) {
      manifest.copied.push({
        analysisId: row.id,
        patientId: row.patientId,
        source: abs,
        dest: "(duplicate_same_file_skipped)",
        duplicateOf: true,
      });
      continue;
    }

    try {
      await fs.access(abs);
    } catch {
      manifest.missing.push({
        analysisId: row.id,
        patientId: row.patientId,
        originalImage: url,
        expectedPath: abs,
      });
      continue;
    }

    const base = path.basename(abs);
    const destName = `${row.patientId}_${row.id}_${base}`;
    const destPath = path.join(outDir, destName);
    await fs.copyFile(abs, destPath);
    seenSrc.add(abs);
    manifest.copied.push({
      analysisId: row.id,
      patientId: row.patientId,
      source: abs,
      dest: destPath,
    });
  }

  await fs.writeFile(
    path.join(outDir, "manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf8",
  );

  console.log(
    JSON.stringify(
      {
        message: "archive_analysis_originals_done",
        outDir,
        copiedFiles: manifest.copied.filter((c) => !c.duplicateOf).length,
        duplicatesSkipped: manifest.copied.filter((c) => c.duplicateOf).length,
        missing: manifest.missing.length,
        skippedUrl: manifest.skippedUrl.length,
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
      "tar komutu çalışmadı (Windows veya tar yok). Klasörü manuel sıkıştırın:",
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
