const DR_LABELS_TR: Record<string, string> = {
  No_DR: "DR Yok",
  no_dr: "DR Yok",
  Mild: "Hafif",
  mild: "Hafif",
  Moderate: "Orta",
  moderate: "Orta",
  Severe: "Ciddi",
  severe: "Ciddi",
  Proliferative_DR: "Proliferatif DR",
  proliferative_dr: "Proliferatif DR",
};

export function drLabelTr(value?: string | null): string {
  if (!value) return "Belirtilmedi";
  const trimmed = value.trim();
  return DR_LABELS_TR[trimmed] ?? trimmed.replace(/_/g, " ");
}
