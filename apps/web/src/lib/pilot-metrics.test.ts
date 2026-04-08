import { describe, expect, it } from "vitest";
import {
  buildPilotMetricSummary,
  computePilotImprovementPercent,
  normalizeSnapshotMonth,
  type PilotMetricRow,
} from "@/lib/pilot-metrics";

describe("pilot-metrics improvement", () => {
  it("calculates positive improvement when lower is better", () => {
    const result = computePilotImprovementPercent({
      baselineValue: 20,
      currentValue: 15,
      direction: "LOWER_IS_BETTER",
    });

    expect(result).not.toBeNull();
    expect(Math.round((result || 0) * 10) / 10).toBe(25);
  });

  it("calculates positive improvement when higher is better", () => {
    const result = computePilotImprovementPercent({
      baselineValue: 40,
      currentValue: 50,
      direction: "HIGHER_IS_BETTER",
    });

    expect(result).not.toBeNull();
    expect(Math.round((result || 0) * 10) / 10).toBe(25);
  });

  it("returns null when baseline is zero", () => {
    const result = computePilotImprovementPercent({
      baselineValue: 0,
      currentValue: 10,
      direction: "LOWER_IS_BETTER",
    });

    expect(result).toBeNull();
  });

  it("keeps latest record per metric in summary", () => {
    const baseDate = new Date("2026-03-01T00:00:00.000Z");
    const rows: PilotMetricRow[] = [
      {
        id: "1",
        doctorId: "d1",
        metricKey: "TIME_PER_PATIENT_MIN",
        metricLabel: "Hasta basina sure",
        direction: "LOWER_IS_BETTER",
        baselineValue: 20,
        currentValue: 18,
        unit: "dk",
        sampleSize: 30,
        periodStart: baseDate,
        periodEnd: baseDate,
        note: null,
        createdAt: new Date("2026-03-03T00:00:00.000Z"),
      },
      {
        id: "2",
        doctorId: "d1",
        metricKey: "TIME_PER_PATIENT_MIN",
        metricLabel: "Hasta basina sure",
        direction: "LOWER_IS_BETTER",
        baselineValue: 20,
        currentValue: 15,
        unit: "dk",
        sampleSize: 45,
        periodStart: baseDate,
        periodEnd: baseDate,
        note: null,
        createdAt: new Date("2026-03-02T00:00:00.000Z"),
      },
    ];

    const summary = buildPilotMetricSummary(rows);
    expect(summary.length).toBe(1);
    expect(summary[0].currentValue).toBe(18);
    expect(Math.round((summary[0].improvementPercent || 0) * 10) / 10).toBe(10);
  });

  it("normalizes snapshot month input", () => {
    expect(normalizeSnapshotMonth("2026-05")).toBe("2026-05");
    expect(normalizeSnapshotMonth("invalid")).toMatch(/^\d{4}-\d{2}$/);
  });
});
