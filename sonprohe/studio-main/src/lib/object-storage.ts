import { randomUUID } from "node:crypto";
import path from "node:path";
import { promises as fs } from "node:fs";

const STORAGE_ROOT = path.join(process.cwd(), "storage");
const OBJECTS_DIR = path.join(STORAGE_ROOT, "objects");
const BACKUPS_DIR = path.join(STORAGE_ROOT, "backups");

type SaveObjectInput = {
  doctorId: string;
  patientId?: string | null;
  category: "original" | "heatmap";
  dataUrlOrBase64: string;
};

function sanitizeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function mimeToExt(mime: string) {
  if (mime.includes("png")) return "png";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("bmp")) return "bmp";
  return "bin";
}

function parseDataUrl(value: string) {
  const trimmed = value.trim();
  const match = trimmed.match(/^data:(.+?);base64,(.+)$/i);
  if (match) {
    return {
      mimeType: match[1].toLowerCase(),
      base64Data: match[2],
      extension: mimeToExt(match[1].toLowerCase()),
    };
  }

  return {
    mimeType: "application/octet-stream",
    base64Data: trimmed,
    extension: "bin",
  };
}

async function ensureStorageDirs() {
  await fs.mkdir(OBJECTS_DIR, { recursive: true });
  await fs.mkdir(BACKUPS_DIR, { recursive: true });
}

export async function saveDataObject(input: SaveObjectInput) {
  await ensureStorageDirs();

  const parsed = parseDataUrl(input.dataUrlOrBase64);
  const doctor = sanitizeSegment(input.doctorId || "doctor");
  const patient = sanitizeSegment(input.patientId || "unknown");
  const date = new Date().toISOString().slice(0, 10);
  const objectKey = `${doctor}/${patient}/${date}/${input.category}-${randomUUID()}.${parsed.extension}`;
  const fullPath = path.join(OBJECTS_DIR, objectKey);

  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, Buffer.from(parsed.base64Data, "base64"));

  return {
    key: objectKey,
    url: `/api/storage/object/${objectKey.split(path.sep).join("/")}`,
    mimeType: parsed.mimeType,
  };
}

export function resolveObjectPathFromKey(keyParts: string[]) {
  const key = keyParts.join("/").replace(/\\/g, "/");
  if (!key || key.includes("..")) {
    return null;
  }

  const fullPath = path.join(OBJECTS_DIR, key);
  if (!fullPath.startsWith(OBJECTS_DIR)) {
    return null;
  }

  return fullPath;
}

export async function createObjectStorageBackup() {
  await ensureStorageDirs();

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.join(BACKUPS_DIR, stamp);
  await fs.mkdir(backupDir, { recursive: true });

  await fs.cp(OBJECTS_DIR, path.join(backupDir, "objects"), {
    recursive: true,
    force: true,
  });

  const manifest = {
    createdAt: new Date().toISOString(),
    source: OBJECTS_DIR,
    backupPath: backupDir,
  };

  await fs.writeFile(
    path.join(backupDir, "manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf8",
  );

  return {
    backupDir,
    manifest,
  };
}
