import { describe, expect, it } from "vitest";
import {
  computePlannedFollowupDate,
  getFollowupDaysForRisk,
  isHighRiskLabel,
} from "@/lib/risk-alerts";
import { getDefaultRetinaSettings } from "@/lib/retina-settings";

describe("risk-alerts", () => {
  it("normalizes and classifies high-risk aliases", () => {
    expect(isHighRiskLabel("YUKSEK RISK")).toBe(true);
    expect(isHighRiskLabel("Ağır Evre")).toBe(true);
    expect(isHighRiskLabel("moderate")).toBe(false);
  });

  it("treats stored disease triage URGENT as high-priority follow-up", () => {
    const settings = getDefaultRetinaSettings();
    settings.triage.highRiskFollowupDays = 2;
    expect(getFollowupDaysForRisk("__DTG__:URGENT|Fundus: x", settings)).toBe(
      2,
    );
  });

  it("uses dynamic followup days by risk bucket", () => {
    const settings = getDefaultRetinaSettings();
    settings.triage.highRiskFollowupDays = 2;
    settings.triage.mediumRiskFollowupDays = 14;
    settings.triage.lowRiskFollowupDays = 120;

    expect(getFollowupDaysForRisk("high_risk", settings)).toBe(2);
    expect(getFollowupDaysForRisk("moderate", settings)).toBe(14);
    expect(getFollowupDaysForRisk("no_dr", settings)).toBe(120);
  });

  it("computes planned followup date from latest analysis date", () => {
    const settings = getDefaultRetinaSettings();
    settings.triage.highRiskFollowupDays = 2;

    const result = computePlannedFollowupDate(
      "2026-03-10T13:00:00.000Z",
      "severe",
      settings,
    );

    expect(result).not.toBeNull();
    expect(result?.toISOString().slice(0, 10)).toBe("2026-03-12");
  });
});
