import type { RetinaSettings } from "@/lib/retina-settings";

export type PatientReportInfo = {
  fullName?: string;
  tcNo?: string;
  age?: number;
};

export type OdirResult = {
  label: string;
  confidence: number;
};

export type RetinaReportPdfInput = {
  patientId: string;
  patientInfo?: PatientReportInfo;
  doctorName?: string;
  reportDate?: Date | string;
  aiResult: string;
  confidence: number;
  odirResults?: OdirResult[];
  clinicalFinalResult?: string;
  doctorFeedback?: string | null;
  doctorNote?: string;
  medications?: string;
  specialComments?: string;
  originalImage?: string | null;
  heatmapUrl?: string | null;
  octImageUrl?: string | null;
  ffaImageUrl?: string | null;
  reportTitle?: string | null;
  reportDateLabel?: string | null;
  sectionAnamnesis?: string | null;
  sectionExamFindings?: string | null;
  sectionLabResults?: string | null;
  sectionClinicalAssessment?: string | null;
  sectionTreatmentRecommendations?: string | null;
  sectionDoctorNotes?: string | null;
  reportDoctorDisplayName?: string | null;
  fundusModalityActive?: boolean;
  /** Geçmiş raporlar → clinical; radyolojik sekme → radiological */
  pdfVariant?: "clinical" | "radiological";
  /** PDF dil şablonu ve yazı tipi (Türkçe/İngilizce karakter desteği) */
  pdfLocale?: "tr" | "en";
  /** Sunucu PDF’inde localStorage yerine DB’den gelen klinik ayar snapshot’ı */
  retinaSettingsSnapshot?: RetinaSettings | null;
};
