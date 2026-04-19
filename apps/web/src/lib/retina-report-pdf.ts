import jsPDF from "jspdf";
import { loadRetinaSettingsFromStorage } from "@/lib/retina-settings";
import { drLabelTr } from "@/lib/dr-label-tr";

type PatientReportInfo = {
  fullName?: string;
  tcNo?: string;
  age?: number;
};

type OdirResult = {
  label: string;
  confidence: number;
};

type RetinaReportPdfInput = {
  patientId: string;
  patientInfo?: PatientReportInfo;
  doctorName?: string;
  reportDate?: Date | string;
  aiResult: string;
  confidence: number;
  odirResults?: OdirResult[];
  clinicalFinalResult?: string;
  doctorNote?: string;
  medications?: string;
  specialComments?: string;
  originalImage?: string | null;
  heatmapUrl?: string | null;
};

type StructuredReport = {
  version?: string;
  reportTitle?: string;
  reportDate?: string;
  doctorName?: string;
  doctorNotes?: string;
  sections?: {
    anamnesis?: string;
    examFindings?: string;
    labResults?: string;
    clinicalAssessment?: string;
    treatmentRecommendations?: string;
  };
  aiSummary?: string;
};

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Tek bir "kelime" max genişlikten büyükse (boşluksuz URL vb.) karakter bazlı böler. */
function breakLongWord(
  ctx: CanvasRenderingContext2D,
  word: string,
  maxWidth: number,
): string[] {
  if (!word) return [];
  const lines: string[] = [];
  let remaining = word;
  while (remaining.length > 0) {
    if (ctx.measureText(remaining).width <= maxWidth) {
      lines.push(remaining);
      break;
    }
    let lo = 1;
    let hi = remaining.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (ctx.measureText(remaining.slice(0, mid)).width <= maxWidth) {
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }
    const take = Math.max(1, lo);
    lines.push(remaining.slice(0, take));
    remaining = remaining.slice(take);
  }
  return lines;
}

function buildWrappedLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  const flushLine = () => {
    if (line) {
      lines.push(line);
      line = "";
    }
  };

  for (const word of words) {
    if (ctx.measureText(word).width <= maxWidth) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth) {
        line = candidate;
      } else {
        flushLine();
        line = word;
      }
    } else {
      flushLine();
      const chunks = breakLongWord(ctx, word, maxWidth);
      for (const chunk of chunks) {
        const candidate = line ? `${line} ${chunk}` : chunk;
        if (ctx.measureText(candidate).width <= maxWidth) {
          line = candidate;
        } else {
          flushLine();
          line = chunk;
        }
      }
    }
  }
  flushLine();
  return lines;
}

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const lines = buildWrappedLines(ctx, text, maxWidth);
  for (const line of lines) {
    ctx.fillText(line, x, y);
    y += lineHeight;
  }
  return y;
}

function toSafeFileName(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function formatLabel(value?: string) {
  return drLabelTr(value);
}

function normalizeForRisk(value: string) {
  return value.toLowerCase().replace(/[^a-z]/g, "");
}

type Priority = "Yüksek" | "Orta" | "Düşük";

function getClinicalPriority(aiResult: string, confidence: number): Priority {
  const normalized = normalizeForRisk(aiResult);

  if (normalized.includes("proliferative") || normalized.includes("severe")) {
    return "Yüksek";
  }
  if (normalized.includes("moderate")) {
    return "Orta";
  }
  if (normalized.includes("mild")) {
    return confidence >= 0.75 ? "Orta" : "Düşük";
  }
  if (normalized.includes("nodr") || normalized.includes("normal")) {
    return "Düşük";
  }

  return confidence >= 0.7 ? "Orta" : "Düşük";
}

function getFollowUpAdvice(priority: Priority) {
  if (priority === "Yüksek") {
    return "24-72 saat içinde retina uzmanına yönlendirme ve acil kontrol önerilir.";
  }
  if (priority === "Orta") {
    return "2-4 hafta içinde kontrol muayenesi ve tedavi uyum değerlendirmesi önerilir.";
  }
  return "3-6 ay rutin takip, glisemik kontrol ve semptom takibi önerilir.";
}

function getPriorityColor(priority: Priority) {
  if (priority === "Yüksek") {
    return { fill: "#FEE2E2", stroke: "#FCA5A5", text: "#991B1B" };
  }
  if (priority === "Orta") {
    return { fill: "#FEF3C7", stroke: "#FCD34D", text: "#92400E" };
  }
  return { fill: "#DCFCE7", stroke: "#86EFAC", text: "#166534" };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function parseStructuredReport(doctorNote?: string) {
  if (!doctorNote) return null;
  try {
    const parsed = JSON.parse(doctorNote) as StructuredReport;
    if (parsed?.version === "manual_report_v2") {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function getLegacyFieldValue(doctorNote: string | undefined, label: string) {
  if (!doctorNote) return null;
  const prefix = `${label}:`;
  const line = doctorNote
    .split("\n")
    .map((v) => v.trim())
    .find((v) => v.startsWith(prefix));
  if (!line) return null;
  return line.slice(prefix.length).trim() || null;
}

async function buildRetinaReportPdf(input: RetinaReportPdfInput) {
  const structured = parseStructuredReport(input.doctorNote);

  const anamnesisText =
    structured?.sections?.anamnesis ||
    getLegacyFieldValue(input.doctorNote, "Klinik Öykü (Anamnez)") ||
    "Belirtilmedi";
  const examFindingsText =
    structured?.sections?.examFindings ||
    getLegacyFieldValue(input.doctorNote, "Muayene Bulguları") ||
    "Belirtilmedi";
  const labResultsText =
    structured?.sections?.labResults ||
    getLegacyFieldValue(input.doctorNote, "Laboratuvar Sonuçları") ||
    "Belirtilmedi";
  const clinicalAssessmentText =
    structured?.sections?.clinicalAssessment ||
    getLegacyFieldValue(input.doctorNote, "Teşhis / Klinik Değerlendirme") ||
    formatLabel(input.clinicalFinalResult ?? input.aiResult);
  const treatmentText =
    structured?.sections?.treatmentRecommendations ||
    getLegacyFieldValue(input.doctorNote, "Tedavi ve Öneriler") ||
    input.medications ||
    "Belirtilmedi";
  const aiSummaryText =
    structured?.aiSummary ||
    getLegacyFieldValue(input.doctorNote, "AI Özeti") ||
    "Belirtilmedi";
  const doctorNotesText =
    structured?.doctorNotes ||
    getLegacyFieldValue(input.doctorNote, "Doktor Notları") ||
    input.specialComments ||
    "Belirtilmedi";

  const settings = loadRetinaSettingsFromStorage();
  const reportSettings = settings.report;
  const doctorDisplayName =
    settings.doctor.signatureName ||
    settings.doctor.fullName ||
    structured?.doctorName ||
    input.doctorName ||
    "Doktor Adı Belirtilmedi";
  const reportTitle =
    structured?.reportTitle ||
    settings.clinic.reportHeader ||
    "RETINA ANALİZ RAPORU";
  const clinicName = settings.clinic.clinicName || "RETINA AI";
  const bodyLineHeight = reportSettings.compactPdf ? 26 : 32;

  const reportDateSource =
    structured?.reportDate && !Number.isNaN(Date.parse(structured.reportDate))
      ? structured.reportDate
      : input.reportDate;
  const reportDate = reportDateSource ? new Date(reportDateSource) : new Date();
  const reportNo = `RPT-${reportDate.toISOString().slice(0, 10).replace(/-/g, "")}-${input.patientId.slice(-6).toUpperCase()}`;
  const priority = getClinicalPriority(input.aiResult, input.confidence);
  const priorityColors = getPriorityColor(priority);
  const finalResult = formatLabel(input.clinicalFinalResult ?? input.aiResult);
  const sortedOdir = [...(input.odirResults ?? [])].sort(
    (a, b) => b.confidence - a.confidence,
  );

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("PDF canvas context oluşturulamadı");
  }

  canvas.width = 1240;
  /** Uzun metinlerde dikey taşmayı önlemek için geniş çizim alanı; PDF’e yalnızca gerçek içerik yüksekliği aktarılır. */
  canvas.height = reportSettings.compactPdf ? 12000 : 14000;

  // A4 page height projected onto canvas coordinates.
  const pageHeightInCanvas = (841.89 * canvas.width) / 595.28;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let y = 90;
  const left = 80;
  const contentWidth = canvas.width - left * 2;

  const ensureSectionFitsOnePage = (
    requiredHeight: number,
    topPadding = 24,
  ) => {
    const pageStart = Math.floor(y / pageHeightInCanvas) * pageHeightInCanvas;
    const pageBottom = pageStart + pageHeightInCanvas;
    if (y + requiredHeight > pageBottom) {
      y = pageBottom + topPadding;
    }
  };

  ctx.fillStyle = "#F2F7FF";
  ctx.fillRect(canvas.width - 360, 40, 280, 90);
  ctx.strokeStyle = "#DBE6F5";
  ctx.lineWidth = 2;
  ctx.strokeRect(canvas.width - 360, 40, 280, 90);
  ctx.fillStyle = "#1E90FF";
  ctx.font = "bold 20px Arial";
  ctx.fillText("RETINA AI", canvas.width - 330, 78);
  ctx.fillStyle = "#6C63FF";
  ctx.font = "17px Arial";
  ctx.fillText("Klinik Rapor", canvas.width - 330, 108);

  ctx.fillStyle = "#0A2540";
  ctx.font = "bold 42px Arial";
  const mainTitleLineH = 50;
  y = wrapCanvasText(
    ctx,
    reportTitle.toUpperCase(),
    left,
    y,
    contentWidth,
    mainTitleLineH,
  );
  y += 8;

  ctx.fillStyle = "#4B5563";
  ctx.font = "20px Arial";
  const metaLineH = 28;
  y = wrapCanvasText(
    ctx,
    reportDate.toLocaleString("tr-TR"),
    left,
    y,
    contentWidth,
    metaLineH,
  );
  y = wrapCanvasText(
    ctx,
    `Rapor No: ${reportNo}`,
    left,
    y,
    contentWidth,
    metaLineH,
  );
  y += 12;

  ctx.strokeStyle = "#DBE6F5";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(left, y);
  ctx.lineTo(canvas.width - left, y);
  ctx.stroke();
  y += 50;

  // Klinik özet kutusu: raporun en üstünde hızlı karar bilgisi (metin uzunsa kutu genişler).
  const summaryBoxTop = y;
  const summaryLeftPad = left + 24;
  const summaryLeftMax = contentWidth - 310 - 48;
  const summaryTitleLineH = 30;
  const summaryBodyLineH = 26;

  ctx.font = "bold 24px Arial";
  const klinikTitleLines = buildWrappedLines(ctx, "Klinik Özet", summaryLeftMax);
  ctx.font = "20px Arial";
  const nihaiLines = buildWrappedLines(
    ctx,
    `Nihai Sonuç: ${finalResult}`,
    summaryLeftMax,
  );
  const aiGuvLines = buildWrappedLines(
    ctx,
    `AI Güven: %${(input.confidence * 100).toFixed(1)}`,
    summaryLeftMax,
  );

  const innerTextHeight =
    38 +
    klinikTitleLines.length * summaryTitleLineH +
    8 +
    (nihaiLines.length + aiGuvLines.length) * summaryBodyLineH +
    20;
  const summaryBoxH = Math.max(138, innerTextHeight);
  const prioH = Math.max(82, summaryBoxH - 52);

  ctx.fillStyle = "#EEF6FF";
  ctx.fillRect(left, y, contentWidth, summaryBoxH);
  ctx.strokeStyle = "#BFDBFE";
  ctx.lineWidth = 2;
  ctx.strokeRect(left, y, contentWidth, summaryBoxH);

  let drawY = y + 38;
  ctx.fillStyle = "#1E3A8A";
  ctx.font = "bold 24px Arial";
  for (const tl of klinikTitleLines) {
    ctx.fillText(tl, summaryLeftPad, drawY);
    drawY += summaryTitleLineH;
  }
  drawY += 4;
  ctx.fillStyle = "#334155";
  ctx.font = "20px Arial";
  for (const line of nihaiLines) {
    ctx.fillText(line, summaryLeftPad, drawY);
    drawY += summaryBodyLineH;
  }
  for (const line of aiGuvLines) {
    ctx.fillText(line, summaryLeftPad, drawY);
    drawY += summaryBodyLineH;
  }

  ctx.fillStyle = priorityColors.fill;
  ctx.fillRect(left + contentWidth - 310, y + 26, 280, prioH);
  ctx.strokeStyle = priorityColors.stroke;
  ctx.strokeRect(left + contentWidth - 310, y + 26, 280, prioH);
  ctx.fillStyle = priorityColors.text;
  ctx.font = "bold 22px Arial";
  const prioBaselineY = y + 26 + Math.floor(prioH / 2) + 8;
  ctx.fillText(`Öncelik: ${priority}`, left + contentWidth - 286, prioBaselineY);

  y = summaryBoxTop + summaryBoxH + 42;

  ctx.fillStyle = "#0A2540";
  ctx.font = "bold 30px Arial";
  ctx.fillText("1) Başlık ve Kimlik Bilgileri", left, y);
  y += 42;

  ctx.fillStyle = "#1F2937";
  ctx.font = "22px Arial";
  const idLineH = 32;
  y = wrapCanvasText(
    ctx,
    `Rapor Adı / Tipi: ${reportTitle}`,
    left,
    y,
    contentWidth,
    idLineH,
  );
  y = wrapCanvasText(
    ctx,
    `Rapor Tarihi / Saati: ${reportDate.toLocaleString("tr-TR")}`,
    left,
    y,
    contentWidth,
    idLineH,
  );
  y = wrapCanvasText(
    ctx,
    `Rapor Numarası: ${reportNo}`,
    left,
    y,
    contentWidth,
    idLineH,
  );
  y = wrapCanvasText(
    ctx,
    `Klinik / Sistem Adı: ${clinicName}`,
    left,
    y,
    contentWidth,
    idLineH,
  );
  y += 24;

  ctx.fillStyle = "#0A2540";
  ctx.font = "bold 30px Arial";
  ctx.fillText("2) Hasta Bilgileri", left, y);
  y += 42;

  ctx.fillStyle = "#1F2937";
  ctx.font = "22px Arial";
  y = wrapCanvasText(
    ctx,
    `Hasta Adı Soyadı: ${input.patientInfo?.fullName ?? "Belirtilmedi"}`,
    left,
    y,
    contentWidth,
    idLineH,
  );
  y = wrapCanvasText(
    ctx,
    `TC / ID No: ${input.patientInfo?.tcNo ?? "Belirtilmedi"}`,
    left,
    y,
    contentWidth,
    idLineH,
  );
  y = wrapCanvasText(
    ctx,
    `Yaş: ${input.patientInfo?.age ?? "Belirtilmedi"}`,
    left,
    y,
    contentWidth,
    idLineH,
  );
  y += 24;

  ctx.fillStyle = "#0A2540";
  ctx.font = "bold 30px Arial";
  ctx.fillText("3) Klinik Form Bulguları", left, y);
  y += 42;

  ctx.fillStyle = "#1F2937";
  ctx.font = "22px Arial";
  y = wrapCanvasText(
    ctx,
    `Klinik Öykü (Anamnez): ${anamnesisText}`,
    left,
    y,
    contentWidth,
    bodyLineHeight,
  );
  y = wrapCanvasText(
    ctx,
    `Muayene Bulguları: ${examFindingsText}`,
    left,
    y,
    contentWidth,
    bodyLineHeight,
  );
  y = wrapCanvasText(
    ctx,
    `Laboratuvar Sonuçları: ${labResultsText}`,
    left,
    y,
    contentWidth,
    bodyLineHeight,
  );
  y = wrapCanvasText(
    ctx,
    `Teşhis / Klinik Değerlendirme: ${clinicalAssessmentText}`,
    left,
    y,
    contentWidth,
    bodyLineHeight,
  );
  y = wrapCanvasText(
    ctx,
    `Tedavi ve Öneriler: ${treatmentText}`,
    left,
    y,
    contentWidth,
    bodyLineHeight,
  );

  y += 22;
  ctx.fillStyle = "#0A2540";
  ctx.font = "bold 30px Arial";
  ctx.fillText("4) AI Bulguları ve Risk Sonuçları", left, y);
  y += 42;

  ctx.fillStyle = "#1F2937";
  ctx.font = "22px Arial";
  y = wrapCanvasText(
    ctx,
    `AI/DR Risk Tahmini - Güven: ${formatLabel(input.aiResult)} (%${(input.confidence * 100).toFixed(1)})`,
    left,
    y,
    contentWidth,
    bodyLineHeight,
  );
  y += 8;

  y = wrapCanvasText(
    ctx,
    `Teşhis / Klinik Değerlendirme (Nihai): ${finalResult}`,
    left,
    y,
    contentWidth,
    bodyLineHeight,
  );
  y = wrapCanvasText(
    ctx,
    `AI Özeti: ${aiSummaryText}`,
    left,
    y,
    contentWidth,
    bodyLineHeight,
  );

  y += 8;
  ctx.fillStyle = "#1F2937";
  ctx.font = "bold 22px Arial";
  ctx.fillText("AI Diğer Hastalık Risk Tahmini - Güven", left, y);
  y += 34;

  ctx.font = "20px Arial";
  if (sortedOdir.length === 0) {
    y = wrapCanvasText(
      ctx,
      "- ODIR sonucu yok",
      left,
      y,
      contentWidth,
      bodyLineHeight,
    );
  } else {
    sortedOdir.forEach((risk, index) => {
      y = wrapCanvasText(
        ctx,
        `${index + 1}) ${formatLabel(risk.label)} - %${(risk.confidence * 100).toFixed(1)}`,
        left,
        y,
        contentWidth,
        bodyLineHeight,
      );
    });
  }

  y = wrapCanvasText(
    ctx,
    `İzlem Önerisi: ${getFollowUpAdvice(priority)}`,
    left,
    y,
    contentWidth,
    bodyLineHeight,
  );

  y += 26;
  ctx.fillStyle = "#0A2540";
  ctx.font = "bold 30px Arial";
  ctx.fillText("5) Ek Doktor Notları", left, y);
  y += 42;

  if (reportSettings.includeDoctorNotes) {
    ctx.fillStyle = "#1F2937";
    ctx.font = "bold 22px Arial";
    ctx.fillText("Doktor Notları", left, y);
    y += 32;

    ctx.font = "20px Arial";
    y = wrapCanvasText(
      ctx,
      doctorNotesText,
      left,
      y,
      contentWidth,
      bodyLineHeight,
    );

    y += 20;
  }

  y += 20;
  ctx.fillStyle = "#0A2540";
  ctx.font = "bold 22px Arial";
  ctx.fillText("Özel Yorumlar", left, y);
  y += 32;

  ctx.fillStyle = "#1F2937";
  ctx.font = "20px Arial";
  y = wrapCanvasText(
    ctx,
    input.specialComments || "Gerekli görülmedi.",
    left,
    y,
    contentWidth,
    bodyLineHeight,
  );

  y += 24;
  ctx.fillStyle = "#0A2540";
  ctx.font = "bold 30px Arial";

  const retinaImageHeight = reportSettings.compactPdf ? 300 : 360;
  const retinaImageWidth = reportSettings.compactPdf ? 430 : 500;
  const imageSectionHeight = retinaImageHeight + 240;
  ensureSectionFitsOnePage(imageSectionHeight, 36);

  ctx.fillText("6) Görüntü Kanıtları", left, y);
  y += 34;

  ctx.fillStyle = "#1F2937";
  ctx.font = "bold 22px Arial";
  ctx.fillText("Retina Görüntüsü", left, y);
  y += 24;

  if (input.originalImage) {
    const retinaImage = await loadImage(input.originalImage);
    ctx.drawImage(retinaImage, left, y, retinaImageWidth, retinaImageHeight);
  }

  if (reportSettings.includeHeatmap) {
    const heatmapX = reportSettings.compactPdf ? left + 520 : left + 580;
    const heatmapYTitle = reportSettings.compactPdf ? y - 18 : y - 24;

    ctx.fillStyle = "#0A2540";
    ctx.font = "bold 22px Arial";
    ctx.fillText("Isı Haritası / Heatmap", heatmapX, heatmapYTitle);

    if (input.heatmapUrl) {
      const heatmapImage = await loadImage(input.heatmapUrl);
      ctx.drawImage(
        heatmapImage,
        heatmapX,
        y,
        retinaImageWidth,
        retinaImageHeight,
      );
    }
  }

  const disclaimerY = y + (reportSettings.compactPdf ? 340 : 430);
  ctx.fillStyle = "#0A2540";
  ctx.font = "bold 28px Arial";
  ctx.fillText("7) Uyarı ve Sorumluluk Notu", left, disclaimerY - 24);

  const disclaimerBody =
    "Bu rapor AI bulgularını klinik karar destek amacıyla sunar. Nihai tanı ve tedavi sorumluluğu doktordadır.";
  ctx.font = "17px Arial";
  const discLines = buildWrappedLines(ctx, disclaimerBody, contentWidth - 32);
  const discLineH = 21;
  const discBoxH = Math.max(78, 34 + discLines.length * discLineH + 20);

  ctx.fillStyle = "#F8FAFC";
  ctx.fillRect(left, disclaimerY, contentWidth, discBoxH);
  ctx.strokeStyle = "#E2E8F0";
  ctx.strokeRect(left, disclaimerY, contentWidth, discBoxH);
  ctx.fillStyle = "#475569";
  ctx.font = "17px Arial";
  const discEndY = wrapCanvasText(
    ctx,
    disclaimerBody,
    left + 16,
    disclaimerY + 34,
    contentWidth - 32,
    discLineH,
  );

  const signTop = disclaimerY + discBoxH + 62;
  ctx.strokeStyle = "#9CA3AF";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(canvas.width - 440, signTop);
  ctx.lineTo(canvas.width - 120, signTop);
  ctx.stroke();

  ctx.fillStyle = "#374151";
  ctx.font = "18px Arial";
  ctx.fillText("Doktor İmza / Kaşe", canvas.width - 430, signTop - 20);
  const nameEndY = wrapCanvasText(
    ctx,
    doctorDisplayName,
    canvas.width - 430,
    signTop + 12,
    400,
    22,
  );

  const exportHeight = Math.min(
    canvas.height,
    Math.ceil(Math.max(discEndY, nameEndY, disclaimerY + discBoxH) + 40),
  );

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const scale = pageWidth / canvas.width;
  const pageHeightInCanvasForSplit = pageHeight / scale;

  let renderedHeight = 0;
  let pageIndex = 0;

  while (renderedHeight < exportHeight) {
    const sliceHeight = Math.min(
      pageHeightInCanvasForSplit,
      exportHeight - renderedHeight,
    );

    const pageCanvas = document.createElement("canvas");
    pageCanvas.width = canvas.width;
    pageCanvas.height = Math.floor(sliceHeight);

    const pageCtx = pageCanvas.getContext("2d");
    if (!pageCtx) break;

    pageCtx.drawImage(
      canvas,
      0,
      renderedHeight,
      canvas.width,
      sliceHeight,
      0,
      0,
      canvas.width,
      sliceHeight,
    );

    const imgData = pageCanvas.toDataURL("image/png");
    if (pageIndex > 0) doc.addPage();
    doc.addImage(imgData, "PNG", 0, 0, pageWidth, sliceHeight * scale);

    renderedHeight += sliceHeight;
    pageIndex += 1;
  }

  const safeName = toSafeFileName(input.patientInfo?.fullName || "hasta");
  const fileName = `retina-raporu-${safeName || "hasta"}-${reportNo}.pdf`;

  return { doc, fileName };
}

export async function downloadRetinaReportPdf(input: RetinaReportPdfInput) {
  const { doc, fileName } = await buildRetinaReportPdf(input);
  doc.save(fileName);
}

export async function previewRetinaReportPdf(input: RetinaReportPdfInput) {
  const previewWindow = window.open("about:blank", "_blank");
  if (!previewWindow) {
    const { doc, fileName } = await buildRetinaReportPdf(input);
    doc.save(fileName);
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

  const { doc, fileName } = await buildRetinaReportPdf(input);
  const blob = doc.output("blob");
  const blobUrl = URL.createObjectURL(blob);

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
