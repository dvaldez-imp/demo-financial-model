import { describe, expect, it } from "vitest";
import type { PeriodRecord } from "@/lib/types/api";
import {
  applyTimelineToPeriods,
  buildPredictionSummary,
  detectPreviewPeriod,
  getPeriodVisualLabel,
  groupPeriodsForBoard,
} from "@/lib/utils/periods";

describe("period helpers", () => {
  it("normalizes mixed month labels and classifies zone", () => {
    expect(detectPreviewPeriod("Jan-26", "2026-03", "2026-12")).toMatchObject({
      normalizedLabel: "ene-26",
      type: "month",
      year: 2026,
      month: 1,
      zone: "historical",
    });
  });

  it("detects yearly summary labels", () => {
    expect(detectPreviewPeriod("2025")).toMatchObject({
      normalizedLabel: "2025",
      type: "year_summary",
      zone: "summary",
    });
  });

  it("applies local timeline zones and groups periods for the board", () => {
    const periods: PeriodRecord[] = [
      {
        key: "2025-01",
        label: "ene-25",
        type: "month",
        year: 2025,
        month: 1,
        zone: "historical",
      },
      {
        key: "2025-04",
        label: "abr-25",
        type: "month",
        year: 2025,
        month: 4,
        zone: "historical",
      },
      {
        key: "2025",
        label: "2025",
        type: "year_summary",
        year: 2025,
        month: null,
        zone: "summary",
      },
    ];

    const displayPeriods = applyTimelineToPeriods(periods, "2025-03", "2025-12");
    const grouped = groupPeriodsForBoard(displayPeriods);

    expect(displayPeriods[1].zone).toBe("forecast");
    expect(grouped.historical).toHaveLength(1);
    expect(grouped.forecast).toHaveLength(1);
    expect(grouped.summary).toHaveLength(1);
  });

  it("builds friendly prediction summaries", () => {
    expect(
      buildPredictionSummary({
        method: "growth_rate_pct",
        params: { rate: 3.5 },
        forecast_start_period_key: "2025-07",
        forecast_end_period_key: "2025-12",
      }),
    ).toContain("3.5%");

    expect(
      buildPredictionSummary({
        method: "moving_average",
        params: { window: 4 },
        forecast_start_period_key: "2026-01",
        forecast_end_period_key: "2026-12",
      }),
    ).toContain("4 meses");
  });

  it("keeps original label as secondary visual hint", () => {
    const period: PeriodRecord = {
      key: "2026-01",
      label: "Jan-26",
      type: "month",
      year: 2026,
      month: 1,
      zone: "forecast",
    };

    expect(getPeriodVisualLabel(period)).toEqual({
      primary: "ene-26",
      secondary: "Jan-26",
      zoneLabel: "Proyeccion",
    });
  });
});
