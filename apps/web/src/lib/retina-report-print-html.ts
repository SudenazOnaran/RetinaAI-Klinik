/**
 * Puppeteer ile PDF'e dönüştürülmek üzere print-ready HTML (inline CSS).
 * — Klinik (metin odaklı) ve Radyolojik (modalite kartları + görüntü).
 */

import { drLabelTr } from "@/lib/dr-label-tr";
import {
  decodeModalityAiAlignedLabel,
  isDoctorApprovalToken,
} from "@/lib/doctor-feedback";
import { prepareRetinaReportPdfModel } from "@/lib/retina-report-pdf-js";
import type { RetinaReportPdfInput } from "@/lib/retina-report-pdf-types";

type PdfLocale = "tr" | "en";

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(value: string): string {
  return escapeHtml(value);
}

function formatLabel(value?: string | null): string {
  return drLabelTr(value);
}

function fmtDate(d: Date, locale: PdfLocale): string {
  return locale === "tr"
    ? d.toLocaleString("tr-TR", { dateStyle: "long", timeStyle: "short" })
    : d.toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short" });
}

function doctorFeedbackPlain(raw: string, locale: PdfLocale): string {
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const mai = decodeModalityAiAlignedLabel(l);
      if (mai) return mai;
      if (isDoctorApprovalToken(l)) return null;
      return l;
    })
    .filter((x): x is string => Boolean(x));
  return lines.map((l) => formatLabel(l)).join(locale === "tr" ? " · " : "; ");
}

function nl2block(text: string): string {
  const esc = escapeHtml(text);
  return esc.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n/g, "<br/>");
}

const LABELS: Record<
  PdfLocale,
  Record<string, string>
> = {
  tr: {
    clinicPlaceholder: "[Klinik adı]",
    clinicalReportTitle: "Klinik Rapor",
    radiologyReportTitle: "Radyolojik AI Analiz Raporu",
    reportTitleLabel: "Rapor başlığı",
    dateRight: "Tarih",
    reportingDoctor: "Raporlayan hekim",
    patientBox: "Hasta bilgileri",
    fullName: "Ad Soyad",
    nationalId: "T.C. / Kimlik No",
    reportDate: "Rapor tarihi",
    age: "Yaş",
    reportNo: "Rapor No",
    anamnesis: "Klinik Öykü (Anamnez)",
    examination: "Muayene Bulguları",
    labs: "Laboratuvar Sonuçları",
    diagnosis: "Teşhis / Klinik Değerlendirme",
    treatment: "Tedavi ve Öneriler",
    doctorNotes: "Doktor Notları",
    aiAnalysisSection: "AI ANALİZ SEKMESİ",
    fundusCard: "Fundus Analizi",
    octCard: "OCT Analizi",
    ffaCard: "FFA Analizi",
    placeholderImage: "Görüntü placeholder",
    aiExplanation: "AI açıklama metni",
    findings: "Bulgular",
    octImageCaption: "Makula OCT görüntüsü",
    clinicalCommentOCT: "Klinik yorum",
    ffaImageCaption: "Anjiyografi görüntüsü",
    vascularAssessment: "Vasküler değerlendirme",
    aiSummarySection: "AI Özet Bölümü",
    overallClinical: "Genel klinik yorum",
    riskLevel: "Risk seviyesi",
    recommendedAction: "Önerilen klinik aksiyon",
    dash: "—",
    none: "Belirtilmedi",
    disclaimer:
      "Bu belge yapay zekâ destekli özet ve görüntüleri içerir; nihai tanı ve tedavi kararı hekime aittir.",
  },
  en: {
    clinicPlaceholder: "[Clinic name]",
    clinicalReportTitle: "Clinical Report",
    radiologyReportTitle: "Radiological AI Imaging Report",
    reportTitleLabel: "Report title",
    dateRight: "Date",
    reportingDoctor: "Reporting physician",
    patientBox: "Patient information",
    fullName: "Patient name",
    nationalId: "National ID",
    reportDate: "Report date",
    age: "Age",
    reportNo: "Report No.",
    anamnesis: "Clinical history",
    examination: "Examination findings",
    labs: "Laboratory results",
    diagnosis: "Diagnosis / clinical assessment",
    treatment: "Treatment and recommendations",
    doctorNotes: "Physician notes",
    aiAnalysisSection: "AI ANALYSIS",
    fundusCard: "Fundus analysis",
    octCard: "OCT analysis",
    ffaCard: "FFA analysis",
    placeholderImage: "Image placeholder",
    aiExplanation: "AI narrative",
    findings: "Findings",
    octImageCaption: "Macular OCT image",
    clinicalCommentOCT: "Clinical comment",
    ffaImageCaption: "Angiography image",
    vascularAssessment: "Vascular assessment",
    aiSummarySection: "AI summary",
    overallClinical: "Overall clinical comment",
    riskLevel: "Risk level",
    recommendedAction: "Recommended clinical action",
    dash: "—",
    none: "Not specified",
    disclaimer:
      "This document contains AI-assisted summaries and images; final diagnosis and treatment decisions remain with the physician.",
  },
};

function L(locale: PdfLocale, key: keyof (typeof LABELS)["tr"]): string {
  return LABELS[locale][key] ?? LABELS.tr[key];
}

/** Metin + güven skorundan yaklaşık risk bandı (Low / Medium / High). */
export function inferAiRiskBand(
  input: RetinaReportPdfInput,
  locale: PdfLocale,
): string {
  const bundle = `${input.aiResult ?? ""} ${input.clinicalFinalResult ?? ""}`;
  const lower = bundle.toLowerCase();
  if (
    /prolif|yüksek risk|ön proliferatif|high risk|\bpdr\b|severe|advanced|sight.?threatening/i.test(
      lower,
    )
  ) {
    return locale === "tr" ? "Yüksek" : "High";
  }
  if (/moderate|orta|moderat|moderately/i.test(lower)) {
    return locale === "tr" ? "Orta" : "Medium";
  }
  const c = input.confidence ?? 0;
  if (c >= 0.82) return locale === "tr" ? "Yüksek" : "High";
  if (c >= 0.55) return locale === "tr" ? "Orta" : "Medium";
  return locale === "tr" ? "Düşük" : "Low";
}

function imgBlock(url: string | null | undefined, placeholder: string): string {
  const u = url?.trim();
  if (!u) {
    return `<div class="img-ph">${escapeHtml(placeholder)}</div>`;
  }
  return `<div class="img-ph img-ph-filled"><img src="${escapeAttr(u)}" alt="" /></div>`;
}

function sectionBlock(
  locale: PdfLocale,
  titleKey: keyof (typeof LABELS)["tr"],
  body: string,
): string {
  const bodySafe = body.trim() ? nl2block(body) : nl2block(L(locale, "none"));
  return `<section class="section"><h2 class="section-title">${escapeHtml(L(locale, titleKey))}</h2><div class="section-body">${bodySafe}</div></section>`;
}

function patientRow(
  locale: PdfLocale,
  labelKey: keyof (typeof LABELS)["tr"],
  value: string,
): string {
  return `<div class="patient-row"><span class="label">${escapeHtml(L(locale, labelKey))}</span><span>${escapeHtml(value)}</span></div>`;
}

function sharedStyles(): string {
  return `
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans:ital,wght@0,400;0,600;0,700;1,400&display=swap');
@page { size: A4; margin: 20mm; }
* { box-sizing: border-box; }
body {
  font-family: 'Noto Sans', system-ui, sans-serif;
  margin: 0;
  padding: 0;
  color: #222;
  font-size: 11pt;
  line-height: 1.45;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  border-bottom: 1px solid #cfd8dc;
  padding-bottom: 12px;
  margin-bottom: 18px;
}
.clinic-name {
  font-size: 10pt;
  color: #546e7a;
  margin-bottom: 4px;
}
.report-main-title {
  font-size: 18pt;
  font-weight: 700;
  color: #37474f;
  margin: 0;
}
.header-meta {
  text-align: right;
  font-size: 10pt;
  color: #455a64;
}
.section { margin-bottom: 18px; page-break-inside: avoid; }
.section-title {
  font-size: 12pt;
  font-weight: 700;
  color: #37474f;
  margin: 0 0 8px 0;
  padding-bottom: 4px;
  border-bottom: 1px solid #eceff1;
}
.section-body { white-space: normal; word-break: break-word; }
.patient-box {
  border: 1px solid #cfd8dc;
  border-radius: 8px;
  padding: 12px 14px;
  margin-bottom: 18px;
  box-shadow: 0 1px 4px rgba(0,0,0,.06);
  background: #fafafa;
}
.patient-box h3 {
  margin: 0 0 10px 0;
  font-size: 11pt;
  font-weight: 700;
  color: #37474f;
}
.patient-row {
  display: grid;
  grid-template-columns: 160px 1fr;
  gap: 8px;
  font-size: 10.5pt;
  margin-bottom: 6px;
}
.label { font-weight: 600; color: #455a64; }
.card {
  border: 1px solid #cfd8dc;
  border-radius: 8px;
  padding: 14px;
  margin-bottom: 14px;
  box-shadow: 0 1px 4px rgba(0,0,0,.07);
  page-break-inside: avoid;
  background: #fff;
}
.card h3 {
  margin: 0 0 10px 0;
  font-size: 12pt;
  font-weight: 700;
  color: #37474f;
}
.card-sub {
  font-size: 10pt;
  font-weight: 600;
  color: #546e7a;
  margin: 10px 0 4px 0;
}
.card-block {
  font-size: 10.5pt;
  margin: 4px 0;
}
.img-ph {
  border: 2px dashed #bdbdbd;
  border-radius: 6px;
  min-height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #757575;
  font-size: 11pt;
  margin: 10px 0;
  background: #fafafa;
}
.img-ph-filled {
  padding: 6px;
  min-height: auto;
}
.img-ph img {
  display: block;
  margin: 0 auto;
  max-width: 100%;
  height: auto;
  max-height: 240mm;
}
body.radiological-report .img-ph img {
  max-height: 118mm;
}
body.radiological-report .img-ph-filled {
  min-height: auto;
  padding: 4px;
}
body.radiological-report .banner-ai {
  margin-top: 6px;
  margin-bottom: 10px;
  font-size: 10pt;
  letter-spacing: 0.04em;
}
body.radiological-report .header {
  margin-bottom: 14px;
  padding-bottom: 10px;
}
body.radiological-report .patient-box {
  margin-bottom: 14px;
}
.banner-ai {
  font-size: 11pt;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: #1565c0;
  margin: 18px 0 12px 0;
}
.footer-note {
  margin-top: 22px;
  padding-top: 12px;
  border-top: 1px solid #eceff1;
  font-size: 9pt;
  color: #607d8b;
}
`;
}

/** Metin tabanlı klinik rapor HTML'i (modalite görüntüsü yok). */
export function buildClinicalReportPrintHtml(
  input: RetinaReportPdfInput,
): string {
  const locale: PdfLocale = input.pdfLocale === "en" ? "en" : "tr";
  const m = prepareRetinaReportPdfModel(input);
  const rs = m.settings.report;
  const title =
    (input.reportTitle && input.reportTitle.trim()) ||
    m.reportTitle ||
    L(locale, "clinicalReportTitle");

  const patientName = input.patientInfo?.fullName ?? L(locale, "dash");
  const pid = input.patientInfo?.tcNo ?? L(locale, "dash");
  const age =
    input.patientInfo?.age !== undefined && input.patientInfo?.age !== null
      ? String(input.patientInfo.age)
      : L(locale, "dash");

  const doctorNotesHtml = rs.includeDoctorNotes
    ? sectionBlock(locale, "doctorNotes", m.doctorNotesText)
    : "";

  const inner = `
<div class="header">
  <div>
    <div class="clinic-name">${escapeHtml(m.clinicName || L(locale, "clinicPlaceholder"))}</div>
    <h1 class="report-main-title">${escapeHtml(title)}</h1>
    <div class="card-block" style="margin-top:6px;"><span class="label">${escapeHtml(L(locale, "reportTitleLabel"))}:</span> ${escapeHtml(m.reportTitle)}</div>
    <div class="card-block"><span class="label">${escapeHtml(L(locale, "reportingDoctor"))}:</span> ${escapeHtml(m.reportingDoctor)}</div>
  </div>
  <div class="header-meta">
    <div><span class="label">${escapeHtml(L(locale, "dateRight"))}</span></div>
    <div>${escapeHtml(fmtDate(m.reportDate, locale))}</div>
    <div style="margin-top:8px;"><span class="label">${escapeHtml(L(locale, "reportNo"))}</span></div>
    <div>${escapeHtml(m.reportNo)}</div>
  </div>
</div>

<div class="patient-box">
  <h3>${escapeHtml(L(locale, "patientBox"))}</h3>
  ${patientRow(locale, "fullName", patientName)}
  ${patientRow(locale, "nationalId", pid)}
  ${patientRow(locale, "reportDate", fmtDate(m.reportDate, locale))}
</div>

${sectionBlock(locale, "anamnesis", m.anamnesisText)}
${sectionBlock(locale, "examination", m.examFindingsClinicalCore)}
${sectionBlock(locale, "labs", m.labResultsText)}
${sectionBlock(locale, "diagnosis", m.clinicalAssessmentText)}
${sectionBlock(locale, "treatment", m.treatmentText)}
${doctorNotesHtml}
<div class="footer-note">${escapeHtml(L(locale, "disclaimer"))}</div>
`;

  return `<!DOCTYPE html>
<html lang="${locale === "en" ? "en" : "tr"}">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(title)}</title>
<style>${sharedStyles()}</style>
</head>
<body>${inner}</body>
</html>`;
}

/** Radyolojik AI raporu — modalite kartları + görüntüler + AI özet. */
export function buildRadiologicalReportPrintHtml(
  input: RetinaReportPdfInput,
): string {
  const locale: PdfLocale = input.pdfLocale === "en" ? "en" : "tr";
  const m = prepareRetinaReportPdfModel(input);
  const rs = m.settings.report;

  const title =
    (input.reportTitle && input.reportTitle.trim()) ||
    m.reportTitle ||
    L(locale, "radiologyReportTitle");

  const patientName = input.patientInfo?.fullName ?? L(locale, "dash");
  const pid = input.patientInfo?.tcNo ?? L(locale, "dash");
  const age =
    input.patientInfo?.age !== undefined && input.patientInfo?.age !== null
      ? String(input.patientInfo.age)
      : L(locale, "dash");

  const showFundus =
    Boolean(String(input.originalImage ?? "").trim()) ||
    Boolean(String(input.heatmapUrl ?? "").trim());
  const showOct = Boolean(String(input.octImageUrl ?? "").trim());
  const showFfa = Boolean(String(input.ffaImageUrl ?? "").trim());

  let fundusAiHtml = "";
  if (showFundus) {
    const odirLines =
      m.sortedOdir.length > 0
        ? m.sortedOdir
            .map(
              (r, i) =>
                `${i + 1}. ${formatLabel(r.label)} (${((r.confidence ?? 0) * 100).toFixed(1)}%)`,
            )
            .join(locale === "tr" ? "; " : "; ")
        : L(locale, "none");
    const dfRaw = m.rawDoctorFeedback;
    const fb =
      dfRaw && !isDoctorApprovalToken(dfRaw)
        ? nl2block(doctorFeedbackPlain(dfRaw, locale))
        : "";

    fundusAiHtml = `
<div class="card-sub">${escapeHtml(L(locale, "findings"))}</div>
<div class="card-block">${nl2block(`${formatLabel(input.aiResult)} (${((input.confidence ?? 0) * 100).toFixed(1)}%) · ${m.finalResult}`)}</div>
${fb ? `<div class="card-sub">${escapeHtml(locale === "tr" ? "Hekim geri bildirimi" : "Physician feedback")}</div><div class="card-block">${fb}</div>` : ""}
<div class="card-sub">${escapeHtml(locale === "tr" ? "ODIR" : "ODIR")}</div>
<div class="card-block">${nl2block(odirLines)}</div>
<div class="card-sub">${escapeHtml(locale === "tr" ? "AI özeti (kayıt)" : "AI summary (stored)")}</div>
<div class="card-block">${nl2block(m.aiSummaryText)}</div>`;
  }

  const octAi =
    m.resolvedExam.oct?.trim() || L(locale, "dash");
  const octClinicalCorrelation =
    m.clinicalAssessmentText?.trim() || L(locale, "dash");
  const ffaAi =
    m.resolvedExam.ffa?.trim() || L(locale, "dash");
  const ffaParts = ffaAi.split(/\n\s*\n/).filter(Boolean);
  const ffaAiParagraph =
    ffaParts[0]?.trim() || ffaAi || L(locale, "dash");
  const ffaVascularParagraph =
    ffaParts.length > 1
      ? ffaParts.slice(1).join("\n\n").trim()
      : L(locale, "dash");

  const fundusCardHtml = showFundus
    ? `
<div class="card">
  <h3>${escapeHtml(L(locale, "fundusCard"))}</h3>
  ${imgBlock(input.originalImage, L(locale, "placeholderImage"))}
  <div class="card-sub">${escapeHtml(L(locale, "aiExplanation"))}</div>
  <div class="card-block">${fundusAiHtml}</div>
</div>`
    : "";

  const octCardHtml = showOct
    ? `
<div class="card">
  <h3>${escapeHtml(L(locale, "octCard"))}</h3>
  ${imgBlock(input.octImageUrl, L(locale, "octImageCaption"))}
  <div class="card-sub">${escapeHtml(L(locale, "aiExplanation"))}</div>
  <div class="card-block">${nl2block(octAi)}</div>
  <div class="card-sub">${escapeHtml(L(locale, "clinicalCommentOCT"))}</div>
  <div class="card-block">${nl2block(octClinicalCorrelation)}</div>
</div>`
    : "";

  const ffaCardHtml = showFfa
    ? `
<div class="card">
  <h3>${escapeHtml(L(locale, "ffaCard"))}</h3>
  ${imgBlock(input.ffaImageUrl, L(locale, "ffaImageCaption"))}
  <div class="card-sub">${escapeHtml(L(locale, "aiExplanation"))}</div>
  <div class="card-block">${nl2block(ffaAiParagraph)}</div>
  <div class="card-sub">${escapeHtml(L(locale, "vascularAssessment"))}</div>
  <div class="card-block">${nl2block(ffaVascularParagraph)}</div>
</div>`
    : "";

  const inner = `
<div class="header">
  <div>
    <div class="clinic-name">${escapeHtml(m.clinicName || L(locale, "clinicPlaceholder"))}</div>
    <h1 class="report-main-title">${escapeHtml(L(locale, "radiologyReportTitle"))}</h1>
    <div class="card-block" style="margin-top:6px;"><span class="label">${escapeHtml(L(locale, "reportTitleLabel"))}:</span> ${escapeHtml(title)}</div>
  </div>
  <div class="header-meta">
    <div><span class="label">${escapeHtml(L(locale, "dateRight"))}</span></div>
    <div>${escapeHtml(fmtDate(m.reportDate, locale))}</div>
    <div style="margin-top:8px;"><span class="label">${escapeHtml(L(locale, "reportNo"))}</span></div>
    <div>${escapeHtml(m.reportNo)}</div>
  </div>
</div>

<div class="patient-box">
  <h3>${escapeHtml(L(locale, "patientBox"))}</h3>
  ${patientRow(locale, "fullName", patientName)}
  ${patientRow(locale, "nationalId", pid)}
  ${patientRow(locale, "age", age)}
  <div class="patient-row"><span class="label">${escapeHtml(L(locale, "reportingDoctor"))}</span><span>${escapeHtml(m.reportingDoctor)}</span></div>
</div>

<div class="banner-ai">${escapeHtml(L(locale, "aiAnalysisSection"))}</div>

${fundusCardHtml}

${octCardHtml}

${ffaCardHtml}

${rs.includeHeatmap && input.heatmapUrl?.trim() && showFundus
    ? `<div class="card"><h3>${escapeHtml(locale === "tr" ? "Isı haritası (Grad-CAM)" : "Heatmap (Grad-CAM)")}</h3>${imgBlock(input.heatmapUrl, L(locale, "placeholderImage"))}</div>`
    : ""}

<div class="footer-note">${escapeHtml(L(locale, "disclaimer"))}</div>
`;

  return `<!DOCTYPE html>
<html lang="${locale === "en" ? "en" : "tr"}">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(title)}</title>
<style>${sharedStyles()}</style>
</head>
<body class="radiological-report">${inner}</body>
</html>`;
}

/** pdfVariant ve pdfLocale ile doğru şablonu seçer. */
export function buildRetinaReportPrintHtml(input: RetinaReportPdfInput): string {
  const variant = input.pdfVariant ?? "clinical";
  return variant === "radiological"
    ? buildRadiologicalReportPrintHtml(input)
    : buildClinicalReportPrintHtml(input);
}
