import type { RetinaReportPdfInput } from "@/lib/retina-report-pdf-types";
import { buildRetinaReportPdfJs } from "@/lib/retina-report-pdf-js";

export type { RetinaReportPdfInput } from "@/lib/retina-report-pdf-types";
export {
  buildClinicalReportPrintHtml,
  buildRadiologicalReportPrintHtml,
  buildRetinaReportPrintHtml,
  inferAiRiskBand,
} from "@/lib/retina-report-print-html";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Sunucu Puppeteer PDF API gövdesi (`POST /api/doctor/report/pdf`). */
export type DoctorReportPdfApiBody = {
  patientId: string;
  reportId: string;
  pdfVariant?: "clinical" | "radiological";
  pdfLocale?: "tr" | "en";
};

/** Kimlik çerezi ile sunucuda üretilen PDF blob + dosya adı. */
export async function fetchRetinaReportPdfBlobFromApi(
  body: DoctorReportPdfApiBody,
): Promise<{ blob: Blob; fileName: string }> {
  const res = await fetch("/api/doctor/report/pdf", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const nameHdr = res.headers.get("X-Retina-File-Name");
  let fileName = "retina-raporu.pdf";
  if (nameHdr) {
    try {
      fileName = decodeURIComponent(nameHdr);
    } catch {
      fileName = nameHdr;
    }
  }
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = (await res.json()) as { error?: string };
      msg = j.error || msg;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  const blob = await res.blob();
  return { blob, fileName };
}

/** Blob olarak üretilen PDF’yi yeni sekmede önizler; popup engelli ise aynı sekmede tarayıcı PDF görüntüleyicide açar (indirme tetiklenmez). */
export function openPdfBlobPreview(blob: Blob, fileName: string): void {
  const blobUrl = URL.createObjectURL(blob);
  const previewWindow = window.open("about:blank", "_blank");
  if (!previewWindow) {
    window.location.assign(blobUrl);
    return;
  }

  previewWindow.document.write(`<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>PDF Önizleme</title>
  <style>
    body { margin: 0; font-family: Arial, sans-serif; display: grid; place-items: center; height: 100vh; background: #0f172a; color: #fff; }
  </style>
</head>
<body>PDF hazırlanıyor...</body>
</html>`);
  previewWindow.document.close();

  const safeTitle = escapeHtml(fileName);

  previewWindow.document.write(`<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle}</title>
  <style>
    body { margin: 0; font-family: Arial, sans-serif; background: #f1f5f9; }
    .toolbar { position: sticky; top: 0; z-index: 10; display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: #0f172a; color: #fff; }
    .title { font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 70vw; }
    button { background: #22c55e; color: #fff; border: 0; border-radius: 8px; padding: 10px 14px; font-weight: 700; cursor: pointer; }
    button:hover { background: #16a34a; }
    iframe { width: 100%; height: calc(100vh - 56px); border: none; background: #e2e8f0; }
  </style>
</head>
<body>
  <div class="toolbar">
    <div class="title">PDF Önizleme: ${safeTitle}</div>
    <button id="downloadBtn">İndir</button>
  </div>
  <iframe src="${blobUrl}"></iframe>
  <script>
    const blobUrl = ${JSON.stringify(blobUrl)};
    const fileName = ${JSON.stringify(fileName)};
    const downloadBtn = document.getElementById("downloadBtn");
    downloadBtn?.addEventListener("click", () => {
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
    });
    window.addEventListener("beforeunload", () => URL.revokeObjectURL(blobUrl));
  </script>
</body>
</html>`);
  previewWindow.document.close();
}

export async function downloadRetinaReportPdfViaApi(
  body: DoctorReportPdfApiBody,
): Promise<void> {
  const { blob, fileName } = await fetchRetinaReportPdfBlobFromApi(body);
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(blobUrl);
}

export async function previewRetinaReportPdfViaApi(
  body: DoctorReportPdfApiBody,
): Promise<void> {
  const { blob, fileName } = await fetchRetinaReportPdfBlobFromApi(body);
  openPdfBlobPreview(blob, fileName);
}

/** İstemci PDF oluşturma — jsPDF (vektör), canvas raster kullanılmıyor. */
export async function buildRetinaReportPdf(input: RetinaReportPdfInput) {
  return buildRetinaReportPdfJs(input);
}

export async function downloadRetinaReportPdf(input: RetinaReportPdfInput) {
  const { doc, fileName } = await buildRetinaReportPdf(input);
  doc.save(fileName);
}

export async function previewRetinaReportPdf(input: RetinaReportPdfInput) {
  const { doc, fileName } = await buildRetinaReportPdf(input);
  const blob = doc.output("blob");
  openPdfBlobPreview(blob, fileName);
}
