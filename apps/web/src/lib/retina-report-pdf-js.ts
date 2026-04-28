/**
 * Retina rapor PDF — jsPDF + gömülü Noto Sans (Türkçe/İngilizce Unicode).
 * Hastane tarzı düzen: geniş kenar boşluklar, bölüm başlıkları, büyük görüntüler.
 */

import jsPDF from "jspdf";
import { drLabelTr } from "@/lib/dr-label-tr";
import { isDoctorApprovalToken } from "@/lib/doctor-feedback";
import { resolveExamAndModalityText } from "@/lib/report-display";
import {
  getDefaultRetinaSettings,
  loadRetinaSettingsFromStorage,
  normalizeRetinaSettings,
  type RetinaSettings,
} from "@/lib/retina-settings";
import type { RetinaReportPdfInput } from "@/lib/retina-report-pdf-types";

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

type PdfLocale = "tr" | "en";

const PDF_COPY: Record<PdfLocale, Record<string, string>> = {
  tr: {
    clinicalBadge: "Klinik rapor",
    radiologyBadge: "Radyolojik AI raporu",
    reportNo: "Rapor No",
    reportingDoctor: "Raporlayan",
    patient: "Hasta",
    nationalId: "TC",
    age: "Yaş",
    summary: "Özet",
    clinicalAssessmentLine: "Klinik değerlendirme",
    fundusAiRisk: "Fundus (AI) risk özeti",
    noFundusAi: "Bu raporda fundus yapay zekâ özeti bulunmuyor.",
    identity: "Başlık ve kimlik",
    reportName: "Rapor adı",
    clinicSystem: "Klinik / sistem",
    editorDoctor: "Raporu düzenleyen hekim",
    patientBlock: "Hasta bilgileri",
    clinicalSections: "Klinik bölümler",
    anamnesis: "Anamnez",
    exam: "Muayene bulguları",
    labs: "Laboratuvar",
    diagnosis: "Teşhis / değerlendirme",
    treatment: "Tedavi ve öneriler",
    doctorNotes: "Doktor notları",
    aiSections: "Yapay zekâ değerlendirmeleri",
    fundusAi: "Fundus (AI)",
    octText: "OCT metni",
    ffaText: "FFA metni",
    octImage: "OCT görüntüsü",
    ffaImage: "FFA görüntüsü",
    aiRiskLine: "AI risk",
    finalLine: "Nihai satır",
    doctorFb: "Doktor geri bildirimi",
    aiSummaryStored: "AI özeti (kayıt)",
    odir: "ODIR",
    noFundusBlock: "Fundus AI bu kayıtta yok.",
    octMissing: "OCT metni eklenmemiş.",
    ffaMissing: "FFA metni eklenmemiş.",
    imagingEvidence: "Fundus ve ısı haritası",
    imagingGallery: "Modalite görüntüleri",
    fundusImg: "Fundus görüntüsü",
    heatmap: "Isı haritası (Grad-CAM)",
    warning: "Uyarı ve sorumluluk",
    disclaimer:
      "Bu belge yapay zekâ destekli özet ve görüntüleri içerir; nihai tanı ve tedavi kararı hekime aittir.",
    signature: "İmza / kaşe",
    aiOverviewRadiology: "AI özet ve modalite metinleri",
    octShort: "OCT",
    ffaShort: "FFA",
    dash: "—",
    radiologyAiOverviewFundus: "Fundus (AI)",

    loadFail: "yüklenemedi",
    imageLoadFail: "Görüntü yüklenemedi",
    none: "Belirtilmedi",
  },
  en: {
    clinicalBadge: "Clinical report",
    radiologyBadge: "Radiology AI report",
    reportNo: "Report No.",
    reportingDoctor: "Reporting physician",
    patient: "Patient",
    nationalId: "National ID",
    age: "Age",
    summary: "Summary",
    clinicalAssessmentLine: "Clinical assessment",
    fundusAiRisk: "Fundus (AI) risk summary",
    noFundusAi: "No fundus AI summary in this record.",
    identity: "Title and identification",
    reportName: "Report title",
    clinicSystem: "Clinic / system",
    editorDoctor: "Reporting physician",
    patientBlock: "Patient information",
    clinicalSections: "Clinical sections",
    anamnesis: "History",
    exam: "Examination findings",
    labs: "Laboratory",
    diagnosis: "Diagnosis / assessment",
    treatment: "Treatment and recommendations",
    doctorNotes: "Physician notes",
    aiSections: "AI assessments",
    fundusAi: "Fundus (AI)",
    octText: "OCT text",
    ffaText: "FFA text",
    octImage: "OCT image",
    ffaImage: "FFA image",
    aiRiskLine: "AI risk",
    finalLine: "Final stage line",
    doctorFb: "Physician feedback",
    aiSummaryStored: "AI summary (stored)",
    odir: "ODIR",
    noFundusBlock: "No fundus AI in this record.",
    octMissing: "No OCT text appended.",
    ffaMissing: "No FFA text appended.",
    imagingEvidence: "Fundus and heatmap",
    imagingGallery: "Modality images",
    fundusImg: "Fundus image",
    heatmap: "Heatmap (Grad-CAM)",
    warning: "Notice",
    disclaimer:
      "This document presents AI-assisted summaries and images; final diagnosis and treatment decisions remain with the physician.",
    signature: "Signature / stamp",
    aiOverviewRadiology: "AI summary and modality text",
    octShort: "OCT",
    ffaShort: "FFA",
    dash: "—",
    radiologyAiOverviewFundus: "Fundus (AI)",
    noFundusSummary: "No fundus AI summary.",
    loadFail: "failed to load",
    imageLoadFail: "Image could not be loaded",
    none: "Not specified",
  },
};

function L(locale: PdfLocale, key: keyof typeof PDF_COPY.tr): string {
  return PDF_COPY[locale][key] ?? PDF_COPY.tr[key];
}

function parseStructuredReport(doctorNote?: string | null) {
  if (!doctorNote) return null;
  try {
    const parsed = JSON.parse(doctorNote) as StructuredReport;
    if (parsed?.version === "manual_report_v2") return parsed;
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

function formatLabel(value?: string) {
  return drLabelTr(value);
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** GitHub Noto hinted TTF — tarayıcıdan yükleme (Unicode); başarısızsa Helvetica. */
async function embedNotoFonts(doc: jsPDF): Promise<boolean> {
  const k = "__retinaNotoOk";
  if ((doc as unknown as Record<string, boolean>)[k] !== undefined) {
    return (doc as unknown as Record<string, boolean>)[k];
  }
  const urls = {
    normal:
      "https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSans/NotoSans-Regular.ttf",
    bold: "https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSans/NotoSans-Bold.ttf",
  };
  try {
    const [nr, nb] = await Promise.all([
      fetch(urls.normal).then((r) => r.arrayBuffer()),
      fetch(urls.bold).then((r) => r.arrayBuffer()),
    ]);
    doc.addFileToVFS("NotoSans-Regular.ttf", uint8ToBase64(new Uint8Array(nr)));
    doc.addFileToVFS("NotoSans-Bold.ttf", uint8ToBase64(new Uint8Array(nb)));
    doc.addFont("NotoSans-Regular.ttf", "NotoSans", "normal");
    doc.addFont("NotoSans-Bold.ttf", "NotoSans", "bold");
    (doc as unknown as Record<string, boolean>)[k] = true;
    return true;
  } catch {
    (doc as unknown as Record<string, boolean>)[k] = false;
    return false;
  }
}

function setPdfFont(doc: jsPDF, style: "normal" | "bold", useUnicode: boolean) {
  if (useUnicode) {
    doc.setFont("NotoSans", style);
  } else {
    doc.setFont("helvetica", style === "bold" ? "bold" : "normal");
  }
}

function addImageDoc(
  doc: jsPDF,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  try {
    doc.addImage(img, "PNG", x, y, w, h);
  } catch {
    doc.addImage(img, "JPEG", x, y, w, h);
  }
}

async function measureImageMm(
  url: string,
  maxWmm: number,
  maxHmm: number,
): Promise<{ w: number; h: number } | null> {
  try {
    const img = await loadImage(url);
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    if (!iw || !ih) return null;
    const ratio = ih / iw;
    let w = maxWmm;
    let h = w * ratio;
    if (h > maxHmm) {
      h = maxHmm;
      w = h / ratio;
    }
    return { w, h };
  } catch {
    return null;
  }
}

function toSafeFileName(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

export type PdfVariant = "clinical" | "radiological";

function resolveReportSettings(input: RetinaReportPdfInput): RetinaSettings {
  if (input.retinaSettingsSnapshot != null) {
    return normalizeRetinaSettings(input.retinaSettingsSnapshot);
  }
  return typeof window !== "undefined"
    ? loadRetinaSettingsFromStorage()
    : getDefaultRetinaSettings();
}

/** Klinik/PDF HTML için tek kaynaklı veri modeli (tarayıcı dışında varsayılan ayarlar). */
export function prepareRetinaReportPdfModel(input: RetinaReportPdfInput) {
  const structured = parseStructuredReport(input.doctorNote);

  const anamnesisText =
    (input.sectionAnamnesis && input.sectionAnamnesis.trim()) ||
    structured?.sections?.anamnesis ||
    getLegacyFieldValue(
      input.doctorNote ?? undefined,
      "Klinik Öykü (Anamnez)",
    ) ||
    "Belirtilmedi";
  const examColumn =
    (input.sectionExamFindings && input.sectionExamFindings.trim()) ||
    structured?.sections?.examFindings ||
    getLegacyFieldValue(input.doctorNote ?? undefined, "Muayene Bulguları") ||
    "";
  const resolvedExam = resolveExamAndModalityText(examColumn, input.doctorNote);
  const labResultsText =
    (input.sectionLabResults && input.sectionLabResults.trim()) ||
    structured?.sections?.labResults ||
    getLegacyFieldValue(
      input.doctorNote ?? undefined,
      "Laboratuvar Sonuçları",
    ) ||
    "Belirtilmedi";
  const clinicalAssessmentText =
    (input.sectionClinicalAssessment &&
      input.sectionClinicalAssessment.trim()) ||
    structured?.sections?.clinicalAssessment ||
    getLegacyFieldValue(
      input.doctorNote ?? undefined,
      "Teşhis / Klinik Değerlendirme",
    ) ||
    formatLabel(input.clinicalFinalResult ?? input.aiResult);
  const treatmentText =
    (input.sectionTreatmentRecommendations &&
      input.sectionTreatmentRecommendations.trim()) ||
    structured?.sections?.treatmentRecommendations ||
    getLegacyFieldValue(input.doctorNote ?? undefined, "Tedavi ve Öneriler") ||
    input.medications ||
    "Belirtilmedi";
  const aiSummaryText =
    structured?.aiSummary ||
    getLegacyFieldValue(input.doctorNote ?? undefined, "AI Özeti") ||
    "Belirtilmedi";
  const doctorNotesText =
    (input.sectionDoctorNotes && input.sectionDoctorNotes.trim()) ||
    structured?.doctorNotes ||
    getLegacyFieldValue(input.doctorNote ?? undefined, "Doktor Notları") ||
    input.specialComments ||
    "Belirtilmedi";

  const settings = resolveReportSettings(input);
  const doctorDisplayName =
    settings.doctor.signatureName ||
    settings.doctor.fullName ||
    structured?.doctorName ||
    input.doctorName ||
    "—";
  const reportTitle =
    (input.reportTitle && input.reportTitle.trim()) ||
    structured?.reportTitle ||
    settings.clinic.reportHeader ||
    "RETINA AI";
  const clinicName = settings.clinic.clinicName || "RETINA AI";

  const reportDateSource =
    input.reportDateLabel &&
    !Number.isNaN(Date.parse(String(input.reportDateLabel)))
      ? input.reportDateLabel
      : structured?.reportDate &&
          !Number.isNaN(Date.parse(structured.reportDate))
        ? structured.reportDate
        : input.reportDate;
  const reportDate = reportDateSource ? new Date(reportDateSource) : new Date();
  const reportNo = `RPT-${reportDate.toISOString().slice(0, 10).replace(/-/g, "")}-${input.patientId.slice(-6).toUpperCase()}`;
  const finalResult = formatLabel(input.clinicalFinalResult ?? input.aiResult);
  const fundusActive =
    Boolean(String(input.originalImage ?? "").trim()) ||
    Boolean(String(input.heatmapUrl ?? "").trim());
  const reportingDoctor =
    (input.reportDoctorDisplayName &&
      String(input.reportDoctorDisplayName).trim()) ||
    doctorDisplayName;
  const sortedOdir = [...(input.odirResults ?? [])].sort(
    (a, b) => b.confidence - a.confidence,
  );

  return {
    structured,
    anamnesisText,
    examFindingsClinicalCore: resolvedExam.clinicalExam,
    resolvedExam,
    labResultsText,
    clinicalAssessmentText,
    treatmentText,
    aiSummaryText,
    doctorNotesText,
    settings,
    reportTitle,
    clinicName,
    reportDate,
    reportNo,
    finalResult,
    fundusActive,
    reportingDoctor,
    sortedOdir,
    rawDoctorFeedback: String(input.doctorFeedback || "").trim(),
  };
}

type Cursor = {
  doc: jsPDF;
  y: number;
  margin: number;
  bottom: number;
  contentW: number;
  pageH: number;
  unicode: boolean;
  locale: PdfLocale;
};

function fmtDate(d: Date, locale: PdfLocale): string {
  return locale === "tr"
    ? d.toLocaleString("tr-TR", {
        dateStyle: "long",
        timeStyle: "short",
      })
    : d.toLocaleString("en-GB", {
        dateStyle: "long",
        timeStyle: "short",
      });
}

function ensureSpace(c: Cursor, needMm: number): void {
  if (c.y + needMm > c.pageH - c.bottom) {
    c.doc.addPage();
    c.y = c.margin;
  }
}

function wrapLines(doc: jsPDF, text: string, maxW: number): string[] {
  return doc.splitTextToSize(text, maxW);
}

function addWrappedParagraph(
  c: Cursor,
  text: string,
  fontSize = 10,
  bold = false,
): void {
  const lines = wrapLines(c.doc, text, c.contentW);
  const lh = fontSize * 0.41;
  for (const line of lines) {
    ensureSpace(c, lh + 1);
    setPdfFont(c.doc, bold ? "bold" : "normal", c.unicode);
    c.doc.setFontSize(fontSize);
    c.doc.text(line, c.margin, c.y);
    c.y += lh;
  }
  c.y += 2;
}

function sectionRule(doc: jsPDF, c: Cursor, locale: PdfLocale): void {
  ensureSpace(c, 10);
  doc.setDrawColor(locale === "tr" ? 30 : 40);
  doc.setLineWidth(0.35);
  doc.line(c.margin, c.y, c.margin + c.contentW, c.y);
  c.y += 6;
}

function addSectionHeading(c: Cursor, title: string, fontSize = 12): void {
  ensureSpace(c, fontSize * 0.55 + 6);
  setPdfFont(c.doc, "bold", c.unicode);
  c.doc.setFontSize(fontSize);
  c.doc.setTextColor(15, 45, 75);
  c.doc.text(title, c.margin, c.y);
  c.doc.setTextColor(30, 30, 30);
  c.y += fontSize * 0.55;
}

async function drawLargeImage(
  c: Cursor,
  url: string | null | undefined,
  title: string,
  maxWmm: number,
  maxHmm: number,
): Promise<void> {
  const u = url?.trim();
  if (!u) return;
  const dim = await measureImageMm(u, maxWmm, maxHmm);
  if (!dim) {
    ensureSpace(c, 8);
    setPdfFont(c.doc, "normal", c.unicode);
    c.doc.setFontSize(9);
    c.doc.text(`(${title}: ${L(c.locale, "loadFail")})`, c.margin, c.y);
    c.y += 10;
    return;
  }
  ensureSpace(c, dim.h + 14);
  setPdfFont(c.doc, "bold", c.unicode);
  c.doc.setFontSize(10);
  c.doc.text(title, c.margin, c.y);
  c.y += 6;
  try {
    const img = await loadImage(u);
    addImageDoc(c.doc, img, c.margin, c.y, dim.w, dim.h);
    c.y += dim.h + 10;
  } catch {
    setPdfFont(c.doc, "normal", c.unicode);
    c.doc.setFontSize(9);
    c.doc.text(`(${title}: ${L(c.locale, "imageLoadFail")})`, c.margin, c.y);
    c.y += 10;
  }
}

/** Yan yana: geniş fundus + daha dar heatmap (yükseklik uyumlu) */
async function drawFundusHeatmapRow(
  c: Cursor,
  originalUrl: string | null | undefined,
  heatmapUrl: string | null | undefined,
  includeHeatmap: boolean,
): Promise<void> {
  const uo = originalUrl?.trim();
  const uh = heatmapUrl?.trim();
  const showFundus = Boolean(uo);
  const showHeat = includeHeatmap && Boolean(uh);
  if (!showFundus && !showHeat) return;

  const rowTop = c.y + 4;
  const fundusSlotW = c.contentW * 0.62;
  const heatSlotW = c.contentW * 0.34;
  const gap = c.contentW * 0.04;
  const maxRowHmm = 92;

  ensureSpace(c, maxRowHmm + 18);

  let x = c.margin;
  if (showFundus) {
    const dim = await measureImageMm(uo!, fundusSlotW, maxRowHmm);
    if (dim) {
      try {
        const img = await loadImage(uo!);
        setPdfFont(c.doc, "bold", c.unicode);
        c.doc.setFontSize(10);
        c.doc.text(L(c.locale, "fundusImg"), x, rowTop);
        addImageDoc(c.doc, img, x, rowTop + 6, dim.w, dim.h);
        x += dim.w + gap;
      } catch {
        /* skip */
      }
    }
  }

  if (showHeat) {
    const dimHM = await measureImageMm(uh!, heatSlotW, maxRowHmm);
    if (dimHM) {
      try {
        const hm = await loadImage(uh!);
        setPdfFont(c.doc, "bold", c.unicode);
        c.doc.setFontSize(10);
        c.doc.text(L(c.locale, "heatmap"), x, rowTop);
        addImageDoc(c.doc, hm, x, rowTop + 6, dimHM.w, dimHM.h);
      } catch {
        /* skip */
      }
    }
  }

  c.y = rowTop + maxRowHmm + 14;
}

function doctorFeedbackPlain(raw: string, locale: PdfLocale): string {
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !isDoctorApprovalToken(l));
  return lines.map((l) => formatLabel(l)).join(locale === "tr" ? " · " : "; ");
}

async function renderClinicalPdf(
  doc: jsPDF,
  input: RetinaReportPdfInput,
  unicode: boolean,
  locale: PdfLocale,
): Promise<void> {
  const m = prepareRetinaReportPdfModel(input);
  const rs = m.settings.report;
  const margin = 18;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - margin * 2;
  const c: Cursor = {
    doc,
    y: margin + 8,
    margin,
    bottom: margin,
    contentW,
    pageH,
    unicode,
    locale,
  };

  doc.setFillColor(241, 248, 255);
  doc.rect(0, 0, pageW, 26, "F");
  setPdfFont(doc, "bold", unicode);
  doc.setFontSize(9);
  doc.setTextColor(25, 80, 140);
  doc.text("RETINA AI", margin, 16);
  doc.setFontSize(8);
  doc.text(L(locale, "clinicalBadge"), margin + 34, 16);
  doc.setTextColor(40, 40, 40);

  c.y = 34;

  addSectionHeading(c, m.reportTitle.toUpperCase(), 15);
  addWrappedParagraph(
    c,
    `${fmtDate(m.reportDate, locale)} · ${L(locale, "reportNo")}: ${m.reportNo}`,
    10,
  );

  addSectionHeading(c, L(locale, "summary"), 12);
  sectionRule(doc, c, locale);
  addWrappedParagraph(
    c,
    `${L(locale, "clinicalAssessmentLine")}: ${m.clinicalAssessmentText}`,
    10,
  );
  addWrappedParagraph(
    c,
    m.fundusActive
      ? `${L(locale, "fundusAiRisk")}: ${formatLabel(input.aiResult)} (${((input.confidence ?? 0) * 100).toFixed(1)}%)`
      : L(locale, "noFundusAi"),
    10,
  );

  addSectionHeading(c, L(locale, "identity"), 12);
  sectionRule(doc, c, locale);
  addWrappedParagraph(c, `${L(locale, "reportName")}: ${m.reportTitle}`, 10);
  addWrappedParagraph(c, `${L(locale, "clinicSystem")}: ${m.clinicName}`, 10);
  addWrappedParagraph(
    c,
    `${L(locale, "editorDoctor")}: ${m.reportingDoctor}`,
    10,
  );

  addSectionHeading(c, L(locale, "patientBlock"), 12);
  sectionRule(doc, c, locale);
  addWrappedParagraph(
    c,
    `${L(locale, "patient")}: ${input.patientInfo?.fullName ?? L(locale, "dash")}`,
    10,
  );
  addWrappedParagraph(
    c,
    `${L(locale, "nationalId")}: ${input.patientInfo?.tcNo ?? L(locale, "dash")}`,
    10,
  );
  addWrappedParagraph(
    c,
    `${L(locale, "age")}: ${input.patientInfo?.age ?? L(locale, "dash")}`,
    10,
  );

  addSectionHeading(c, L(locale, "clinicalSections"), 12);
  sectionRule(doc, c, locale);
  addWrappedParagraph(c, `${L(locale, "anamnesis")}: ${m.anamnesisText}`, 10);
  addWrappedParagraph(
    c,
    `${L(locale, "exam")}: ${m.examFindingsClinicalCore}`,
    10,
  );
  addWrappedParagraph(c, `${L(locale, "labs")}: ${m.labResultsText}`, 10);
  addWrappedParagraph(
    c,
    `${L(locale, "diagnosis")}: ${m.clinicalAssessmentText}`,
    10,
  );
  addWrappedParagraph(c, `${L(locale, "treatment")}: ${m.treatmentText}`, 10);
  if (rs.includeDoctorNotes) {
    addWrappedParagraph(
      c,
      `${L(locale, "doctorNotes")}: ${m.doctorNotesText}`,
      10,
    );
  }

  addSectionHeading(c, L(locale, "aiSections"), 12);
  sectionRule(doc, c, locale);
  addWrappedParagraph(c, `${L(locale, "fundusAi")}`, 10, true);
  if (m.fundusActive) {
    addWrappedParagraph(
      c,
      `${L(locale, "aiRiskLine")}: ${formatLabel(input.aiResult)} — ${((input.confidence ?? 0) * 100).toFixed(1)}%`,
      10,
    );
    addWrappedParagraph(c, `${L(locale, "finalLine")}: ${m.finalResult}`, 10);
    const raw = m.rawDoctorFeedback;
    if (raw && !isDoctorApprovalToken(raw)) {
      addWrappedParagraph(
        c,
        `${L(locale, "doctorFb")}: ${doctorFeedbackPlain(raw, locale)}`,
        10,
      );
    }
    addWrappedParagraph(
      c,
      `${L(locale, "aiSummaryStored")}: ${m.aiSummaryText}`,
      10,
    );
    if (m.sortedOdir.length > 0) {
      const od = m.sortedOdir.map(
        (r, i) =>
          `${i + 1}. ${formatLabel(r.label)} (${((r.confidence ?? 0) * 100).toFixed(1)}%)`,
      );
      addWrappedParagraph(c, `${L(locale, "odir")}: ${od.join("; ")}`, 10);
    }
  } else {
    addWrappedParagraph(c, L(locale, "noFundusBlock"), 10);
  }

  addWrappedParagraph(c, `${L(locale, "octText")}`, 10, true);
  addWrappedParagraph(c, m.resolvedExam.oct || L(locale, "octMissing"), 10);
  await drawLargeImage(
    c,
    input.octImageUrl,
    L(locale, "octImage"),
    contentW,
    78,
  );

  addWrappedParagraph(c, `${L(locale, "ffaText")}`, 10, true);
  addWrappedParagraph(c, m.resolvedExam.ffa || L(locale, "ffaMissing"), 10);
  await drawLargeImage(
    c,
    input.ffaImageUrl,
    L(locale, "ffaImage"),
    contentW,
    78,
  );

  addSectionHeading(c, L(locale, "imagingEvidence"), 12);
  sectionRule(doc, c, locale);
  await drawFundusHeatmapRow(
    c,
    input.originalImage,
    input.heatmapUrl,
    rs.includeHeatmap,
  );

  addSectionHeading(c, L(locale, "warning"), 11);
  addWrappedParagraph(c, L(locale, "disclaimer"), 9);
  ensureSpace(c, 28);
  doc.setDrawColor(160);
  doc.line(c.margin, c.y + 4, c.margin + 60, c.y + 4);
  setPdfFont(doc, "normal", unicode);
  doc.setFontSize(9);
  doc.text(L(locale, "signature"), c.margin, c.y + 12);
  doc.text(m.reportingDoctor, c.margin, c.y + 20);
  c.y += 28;
}

async function renderRadiologicalPdf(
  doc: jsPDF,
  input: RetinaReportPdfInput,
  unicode: boolean,
  locale: PdfLocale,
): Promise<void> {
  const m = prepareRetinaReportPdfModel(input);
  const rs = m.settings.report;
  const margin = 18;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - margin * 2;
  const c: Cursor = {
    doc,
    y: margin + 8,
    margin,
    bottom: margin,
    contentW,
    pageH,
    unicode,
    locale,
  };

  doc.setFillColor(238, 246, 252);
  doc.rect(0, 0, pageW, 30, "F");
  doc.setDrawColor(45, 110, 170);
  doc.setLineWidth(0.8);
  doc.line(0, 30, pageW, 30);
  setPdfFont(doc, "bold", unicode);
  doc.setFontSize(11);
  doc.setTextColor(18, 56, 92);
  doc.text("RETINA AI", margin, 18);
  doc.setFontSize(10);
  doc.text(L(locale, "radiologyBadge"), margin + 38, 18);
  doc.setTextColor(35, 35, 35);

  c.y = 38;

  addSectionHeading(c, m.reportTitle.toUpperCase(), 16);
  addWrappedParagraph(
    c,
    `${fmtDate(m.reportDate, locale)} · ${L(locale, "reportNo")} ${m.reportNo}`,
    10,
  );
  addWrappedParagraph(
    c,
    `${L(locale, "patient")}: ${input.patientInfo?.fullName ?? L(locale, "dash")} · ${L(locale, "nationalId")}: ${input.patientInfo?.tcNo ?? L(locale, "dash")} · ${L(locale, "age")}: ${input.patientInfo?.age ?? L(locale, "dash")}`,
    10,
  );
  addWrappedParagraph(
    c,
    `${L(locale, "reportingDoctor")}: ${m.reportingDoctor}`,
    10,
  );

  addSectionHeading(c, L(locale, "aiOverviewRadiology"), 12);
  sectionRule(doc, c, locale);
  addWrappedParagraph(c, L(locale, "radiologyAiOverviewFundus"), 10, true);
  if (m.fundusActive) {
    addWrappedParagraph(
      c,
      `${L(locale, "aiRiskLine")}: ${formatLabel(input.aiResult)} (${((input.confidence ?? 0) * 100).toFixed(1)}%) · ${m.finalResult}`,
      10,
    );
    const raw = m.rawDoctorFeedback;
    if (raw && !isDoctorApprovalToken(raw)) {
      addWrappedParagraph(
        c,
        `${L(locale, "doctorFb")}: ${doctorFeedbackPlain(raw, locale)}`,
        10,
      );
    }
    addWrappedParagraph(c, m.aiSummaryText, 10);
    if (m.sortedOdir.length > 0) {
      const od = m.sortedOdir.map(
        (r, i) =>
          `${i + 1}. ${formatLabel(r.label)} (${((r.confidence ?? 0) * 100).toFixed(1)}%)`,
      );
      addWrappedParagraph(c, `${L(locale, "odir")}: ${od.join("; ")}`, 10);
    }
  } else {
    addWrappedParagraph(c, L(locale, "noFundusSummary"), 10);
  }

  addWrappedParagraph(c, L(locale, "octShort"), 10, true);
  addWrappedParagraph(c, m.resolvedExam.oct || L(locale, "dash"), 10);

  addWrappedParagraph(c, L(locale, "ffaShort"), 10, true);
  addWrappedParagraph(c, m.resolvedExam.ffa || L(locale, "dash"), 10);

  addSectionHeading(c, L(locale, "imagingGallery"), 13);
  sectionRule(doc, c, locale);
  await drawFundusHeatmapRow(
    c,
    input.originalImage,
    input.heatmapUrl,
    rs.includeHeatmap,
  );

  await drawLargeImage(
    c,
    input.octImageUrl,
    L(locale, "octImage"),
    contentW,
    95,
  );
  await drawLargeImage(
    c,
    input.ffaImageUrl,
    L(locale, "ffaImage"),
    contentW,
    95,
  );

  addSectionHeading(c, L(locale, "warning"), 11);
  addWrappedParagraph(c, L(locale, "disclaimer"), 9);
  ensureSpace(c, 28);
  doc.setDrawColor(160);
  doc.line(c.margin, c.y + 4, c.margin + 60, c.y + 4);
  setPdfFont(doc, "normal", unicode);
  doc.setFontSize(9);
  doc.text(L(locale, "signature"), c.margin, c.y + 12);
  doc.text(m.reportingDoctor, c.margin, c.y + 20);
  c.y += 28;
}

export async function buildRetinaReportPdfJs(
  input: RetinaReportPdfInput,
): Promise<{ doc: jsPDF; fileName: string }> {
  const variant = input.pdfVariant ?? "clinical";
  const locale: PdfLocale = input.pdfLocale === "en" ? "en" : "tr";
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });

  const unicodeOk = await embedNotoFonts(doc);

  if (variant === "radiological") {
    await renderRadiologicalPdf(doc, input, unicodeOk, locale);
  } else {
    await renderClinicalPdf(doc, input, unicodeOk, locale);
  }

  const model = prepareRetinaReportPdfModel(input);
  const safeName = toSafeFileName(input.patientInfo?.fullName || "hasta");
  const fileName = `retina-raporu-${safeName || "hasta"}-${model.reportNo}.pdf`;

  return { doc, fileName };
}
