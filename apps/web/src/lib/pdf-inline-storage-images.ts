/**
 * Puppeteer PDF üretimi oturum çerezi göndermediği için `/api/storage/object/...`
 * adreslerini HTTP ile yüklemez. Sunucuda diskten okuyup data URL üretir (mutlak veya göreli URL).
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import type { RetinaReportPdfInput } from "@/lib/retina-report-pdf-types";
import { resolveObjectPathFromKey } from "@/lib/object-storage";

const STORAGE_OBJECT_MARKER = "/api/storage/object/";

function mimeFromExt(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".bmp") return "image/bmp";
  return "application/octet-stream";
}

function extractStorageKeyParts(href: string): string[] | null {
  const idx = href.indexOf(STORAGE_OBJECT_MARKER);
  if (idx === -1) return null;
  const rest = href.slice(idx + STORAGE_OBJECT_MARKER.length).split(/[?#]/)[0];
  if (!rest?.trim()) return null;
  return rest.split("/").filter(Boolean).map((s) => {
    try {
      return decodeURIComponent(s);
    } catch {
      return s;
    }
  });
}

async function hrefToDataUrl(
  href: string | null | undefined,
): Promise<string | null | undefined> {
  const u = String(href ?? "").trim();
  if (!u) return href;
  if (u.startsWith("data:")) return u;

  const keyParts = extractStorageKeyParts(u);
  if (!keyParts?.length) return href;

  const diskPath = resolveObjectPathFromKey(keyParts);
  if (!diskPath) return href;

  try {
    const buf = await fs.readFile(diskPath);
    const mime = mimeFromExt(diskPath);
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return href;
  }
}

export async function inlineRetinaReportStorageImagesForPdf(
  input: RetinaReportPdfInput,
): Promise<RetinaReportPdfInput> {
  const [
    originalImage,
    heatmapUrl,
    octImageUrl,
    ffaImageUrl,
  ] = await Promise.all([
    hrefToDataUrl(input.originalImage),
    hrefToDataUrl(input.heatmapUrl),
    hrefToDataUrl(input.octImageUrl),
    hrefToDataUrl(input.ffaImageUrl),
  ]);

  return {
    ...input,
    originalImage: originalImage ?? input.originalImage,
    heatmapUrl: heatmapUrl ?? input.heatmapUrl,
    octImageUrl: octImageUrl ?? input.octImageUrl,
    ffaImageUrl: ffaImageUrl ?? input.ffaImageUrl,
  };
}
