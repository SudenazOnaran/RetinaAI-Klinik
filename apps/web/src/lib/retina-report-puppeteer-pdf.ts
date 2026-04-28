/**
 * Sunucu tarafında: print-ready HTML → Puppeteer → PDF baytı.
 * Dinamik import ile istemci paketlemeye dahil edilmez.
 */

import { prepareRetinaReportPdfModel } from "@/lib/retina-report-pdf-js";
import type { RetinaReportPdfInput } from "@/lib/retina-report-pdf-types";

import { buildRetinaReportPrintHtml } from "@/lib/retina-report-print-html";

function toSafeFileName(value: string): string {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

export async function renderPrintHtmlToPdfBuffer(html: string): Promise<Uint8Array> {
  const puppeteer = await import("puppeteer");
  const browser = await puppeteer.default.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, {
      waitUntil: "networkidle0",
      timeout: 120_000,
    });
    const buf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "20mm",
        right: "20mm",
        bottom: "20mm",
        left: "20mm",
      },
    });
    return new Uint8Array(buf);
  } finally {
    await browser.close();
  }
}

/** Hasta raporu payload’undan Puppeteer ile PDF üretir (Node.js ortamı). */
export async function buildRetinaReportPdfWithPuppeteer(
  input: RetinaReportPdfInput,
): Promise<{ pdf: Uint8Array; fileName: string }> {
  const html = buildRetinaReportPrintHtml(input);
  const pdf = await renderPrintHtmlToPdfBuffer(html);
  const model = prepareRetinaReportPdfModel(input);
  const safeName = toSafeFileName(input.patientInfo?.fullName || "hasta");
  const fileName = `retina-raporu-${safeName || "hasta"}-${model.reportNo}.pdf`;
  return { pdf, fileName };
}
