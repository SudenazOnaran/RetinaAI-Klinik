export type RetinaSettings = {
  doctor: {
    fullName: string;
    branch: string;
    licenseNo: string;
    contactPhone: string;
    signatureName: string;
  };
  clinic: {
    clinicName: string;
    address: string;
    reportHeader: string;
  };
  report: {
    includeDoctorNotes: boolean;
    includeHeatmap: boolean;
    includeMedications: boolean;
    autoOpenPreview: boolean;
    compactPdf: boolean;
  };
  triage: {
    highRiskFollowupDays: number;
    mediumRiskFollowupDays: number;
    lowRiskFollowupDays: number;
    aiConfidenceThreshold: number;
  };
  notifications: {
    criticalCaseAlert: boolean;
    dailySummary: boolean;
    followupReminder: boolean;
  };
  appearance: {
    darkMode: boolean;
    denseTable: boolean;
  };
};

export const SETTINGS_STORAGE_KEY = "retina-settings-v1";

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export const getDefaultRetinaSettings = (): RetinaSettings => ({
  doctor: {
    fullName: "",
    branch: "Göz Hastalıkları",
    licenseNo: "",
    contactPhone: "",
    signatureName: "",
  },
  clinic: {
    clinicName: "Retina Analiz Merkezi",
    address: "",
    reportHeader: "RETINA ANALİZ RAPORU",
  },
  report: {
    includeDoctorNotes: true,
    includeHeatmap: true,
    includeMedications: true,
    autoOpenPreview: true,
    compactPdf: true,
  },
  triage: {
    highRiskFollowupDays: 2,
    mediumRiskFollowupDays: 14,
    lowRiskFollowupDays: 120,
    aiConfidenceThreshold: 0.7,
  },
  notifications: {
    criticalCaseAlert: true,
    dailySummary: false,
    followupReminder: true,
  },
  appearance: {
    darkMode: false,
    denseTable: false,
  },
});

export function normalizeRetinaSettings(
  value: Partial<RetinaSettings> | null | undefined,
): RetinaSettings {
  const defaults = getDefaultRetinaSettings();
  const merged: RetinaSettings = {
    ...defaults,
    ...(value || {}),
    doctor: { ...defaults.doctor, ...(value?.doctor || {}) },
    clinic: { ...defaults.clinic, ...(value?.clinic || {}) },
    report: { ...defaults.report, ...(value?.report || {}) },
    triage: { ...defaults.triage, ...(value?.triage || {}) },
    notifications: {
      ...defaults.notifications,
      ...(value?.notifications || {}),
    },
    appearance: { ...defaults.appearance, ...(value?.appearance || {}) },
  };

  merged.triage = {
    highRiskFollowupDays: clamp(
      Number(merged.triage.highRiskFollowupDays) || 1,
      1,
      30,
    ),
    mediumRiskFollowupDays: clamp(
      Number(merged.triage.mediumRiskFollowupDays) || 7,
      1,
      180,
    ),
    lowRiskFollowupDays: clamp(
      Number(merged.triage.lowRiskFollowupDays) || 90,
      1,
      365,
    ),
    aiConfidenceThreshold: clamp(
      Number(merged.triage.aiConfidenceThreshold) || 0.7,
      0.5,
      0.99,
    ),
  };

  return merged;
}

export function loadRetinaSettingsFromStorage(): RetinaSettings {
  if (typeof window === "undefined") {
    return getDefaultRetinaSettings();
  }

  const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
  if (!raw) {
    return getDefaultRetinaSettings();
  }

  try {
    const parsed = JSON.parse(raw) as Partial<RetinaSettings>;
    return normalizeRetinaSettings(parsed);
  } catch {
    return getDefaultRetinaSettings();
  }
}

export function saveRetinaSettingsToStorage(settings: RetinaSettings) {
  if (typeof window === "undefined") return;

  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));

  // Legacy keys for older consumers.
  localStorage.setItem("darkMode", String(settings.appearance.darkMode));
  localStorage.setItem("reportTitle", settings.clinic.reportHeader);
  localStorage.setItem(
    "includeDoctorNotes",
    String(settings.report.includeDoctorNotes),
  );

  window.dispatchEvent(
    new CustomEvent("retina-settings-updated", { detail: settings }),
  );
}
