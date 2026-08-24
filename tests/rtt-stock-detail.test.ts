import { describe, expect, it } from "vitest";

import { buildStockDetailViewModel } from "../src/lib/rtt-stock-detail";
import { formatScoreWithMaximum } from "../src/lib/score-display";

describe("RTT stock detail view model", () => {
  it("builds a detail model for a qualified stock", () => {
    const detail = buildStockDetailViewModel("HAL");

    expect(detail).not.toBeNull();
    expect(detail?.qualified).toBe(true);
    expect(detail?.rttScore).not.toBeNull();
    expect(detail?.classification).toBeDefined();
    expect(detail?.componentScores.length).toBe(6);
    expect(detail?.ema10).not.toBeNull();
    expect(detail?.ema200).not.toBeNull();
    expect(detail?.rsi14).not.toBeNull();
    expect(detail?.momentum20d).not.toBeNull();
    expect(detail?.rvol).not.toBeNull();
    expect(detail?.high52Week).not.toBeNull();
  });

  it("maps the detail model from the RTT engine output without exposing proprietary thresholds", () => {
    const detail = buildStockDetailViewModel("HAL");

    expect(detail?.componentScores[0]?.label).toBe("Price vs EMA Structure");
    expect(detail?.componentScores[0]?.score).toBeGreaterThanOrEqual(0);
    expect(detail?.componentScores[0]?.maximum).toBeGreaterThan(0);
    expect(detail?.qualitativeExplanations["Momentum"]).toContain("momentum");
  });

  it("does not expose EMA Stack Quality in the user-facing score breakdown", () => {
    const detail = buildStockDetailViewModel("HAL");

    expect(detail?.componentScores.some((component) => component.label === "EMA Stack Quality")).toBe(false);
    expect(detail?.qualitativeExplanations["EMA Stack Quality"]).toBeUndefined();
  });

  it("formats component scores as score/max without the 100-denominator", () => {
    expect(formatScoreWithMaximum(20, 20)).toBe("20/20");
    expect(formatScoreWithMaximum(15, 15)).toBe("15/15");
    expect(formatScoreWithMaximum(null, 20)).toBe("N/A/20");
  });

  it("handles invalid or rejected symbols as unavailable", () => {
    const detail = buildStockDetailViewModel("NOT_A_STOCK");

    expect(detail).toBeNull();
  });
});
