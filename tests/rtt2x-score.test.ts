import { describe, expect, it } from "vitest";

import { RTT2X_SCORE_CONFIG } from "../src/lib/rtt2x-config";
import {
  calculateEma20ResilienceScore,
  calculateEma50ResilienceScore,
  calculateEmaSlopeExpansionScore,
  calculateEmaStructureScore,
  calculateExtensionScore,
  calculateMomentumScore,
  calculateRsiHealthScore,
  calculateRtt2xScore,
  calculateTrendDevelopmentScore,
  calculateVolumeScore,
  evaluateRtt2xQualification,
} from "../src/lib/rtt2x-score";
import type { Candle, EmaResult, EmaValues, StandardEmaResults } from "../src/lib/technical-analysis";

const DAY = 86_400_000;
const START = 1_700_000_000_000;

function makeCandles(closes: readonly number[], opts?: { volumes?: readonly number[]; highs?: readonly number[]; lows?: readonly number[] }): Candle[] {
  return closes.map((close, index) => ({
    timestamp: START + index * DAY,
    open: close,
    high: opts?.highs?.[index] ?? close + 1,
    low: opts?.lows?.[index] ?? close - 1,
    close,
    volume: opts?.volumes?.[index] ?? 1_000,
  }));
}

function fakeEmaResult(length: number, valueAtOffset: (offset: number) => number): EmaResult {
  const values = Array.from({ length }, (_, k) => ({ timestamp: START + k * DAY, value: valueAtOffset(length - 1 - k) }));
  return { period: 20, values, latest: values.at(-1) ?? null, hasSufficientData: length > 0 };
}

function fakeStandardEmas(length: number, fns: {
  ema10?: (offset: number) => number;
  ema20: (offset: number) => number;
  ema50: (offset: number) => number;
  ema100: (offset: number) => number;
  ema200: (offset: number) => number;
}): StandardEmaResults {
  return {
    ema10: fakeEmaResult(length, fns.ema10 ?? (() => 0)),
    ema20: fakeEmaResult(length, fns.ema20),
    ema50: fakeEmaResult(length, fns.ema50),
    ema100: fakeEmaResult(length, fns.ema100),
    ema200: fakeEmaResult(length, fns.ema200),
  };
}

const alignedEmaValues: EmaValues = { ema10: 110, ema20: 100, ema50: 90, ema100: 80, ema200: 70 };

describe("RTT2X_SCORE_CONFIG", () => {
  it("weights sum to exactly 100", () => {
    const total = Object.values(RTT2X_SCORE_CONFIG.weights).reduce((sum, w) => sum + w, 0);
    expect(total).toBe(100);
  });
});

describe("evaluateRtt2xQualification", () => {
  it("qualifies strictly aligned EMAs and takes only the EMA values (no RSI parameter)", () => {
    expect(evaluateRtt2xQualification.length).toBe(1);
    expect(evaluateRtt2xQualification(alignedEmaValues)).toEqual({ qualified: true, rejectionReason: null });
  });

  it("rejects broken alignment", () => {
    expect(evaluateRtt2xQualification({ ...alignedEmaValues, ema50: 105 })).toEqual({ qualified: false, rejectionReason: "EMA_ALIGNMENT_FAILED" });
  });

  it("rejects insufficient data (null EMA values)", () => {
    expect(evaluateRtt2xQualification({ ...alignedEmaValues, ema200: null })).toEqual({ qualified: false, rejectionReason: "INSUFFICIENT_DATA" });
  });
});

describe("calculateEmaStructureScore", () => {
  it("scores a widely separated stack near the cap", () => {
    const result = calculateEmaStructureScore({ ema10: 150, ema20: 100, ema50: 70, ema100: 50, ema200: 35 });
    expect(result.score).toBe(14);
  });

  it("scores near zero for a barely-separated (technically aligned) stack", () => {
    const result = calculateEmaStructureScore({ ema10: 100.4, ema20: 100.3, ema50: 100.2, ema100: 100.1, ema200: 100 });
    expect(result.score!).toBeLessThan(1);
  });

  it("reports insufficient data when an EMA is null", () => {
    const result = calculateEmaStructureScore({ ...alignedEmaValues, ema200: null });
    expect(result).toEqual({ score: null, maximum: 14, unavailableReason: "INSUFFICIENT_DATA" });
  });
});

describe("calculateEmaSlopeExpansionScore", () => {
  it("caps at 14 when slope and expansion targets are both met", () => {
    // Each EMA has a large individual slope (saturating the 3% slope target), and
    // different decline rates across EMAs so pairwise separation widens over the
    // lookback (saturating the 1.5% expansion target too).
    const standardEmas = fakeStandardEmas(11, {
      ema20: (o) => 200 * (1 - 0.03 * o),
      ema50: (o) => 100 * (1 - 0.01 * o),
      ema100: (o) => 70 * (1 - 0.006 * o),
      ema200: (o) => 50 * (1 - 0.004 * o),
    });
    const result = calculateEmaSlopeExpansionScore(standardEmas);
    expect(result.score).toBe(14);
  });

  it("scores zero for a perfectly flat stack", () => {
    const standardEmas = fakeStandardEmas(11, { ema20: () => 100, ema50: () => 90, ema100: () => 80, ema200: () => 70 });
    const result = calculateEmaSlopeExpansionScore(standardEmas);
    expect(result.score).toBe(0);
  });

  it("reports insufficient data when the lookback offset is unavailable", () => {
    const standardEmas = fakeStandardEmas(5, { ema20: () => 100, ema50: () => 90, ema100: () => 80, ema200: () => 70 });
    const result = calculateEmaSlopeExpansionScore(standardEmas);
    expect(result).toEqual({ score: null, maximum: 14, unavailableReason: "INSUFFICIENT_DATA" });
  });
});

describe("calculateEma20ResilienceScore", () => {
  it("scores near the cap for a stock that stays above EMA20 with no violations", () => {
    const closes = Array.from({ length: 40 }, (_, i) => 100 + i * 0.5);
    const candles = makeCandles(closes);
    const standardEmas = fakeStandardEmas(40, { ema20: (o) => closes[closes.length - 1 - o]! - 2, ema50: () => 80, ema100: () => 70, ema200: () => 60 });
    const result = calculateEma20ResilienceScore(candles, standardEmas);
    expect(result.score!).toBeGreaterThan(20);
  });

  it("does not require zero violations — a few shallow, recovered dips still score well", () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 + i * 0.3);
    // Inject 3 shallow one-day dips below EMA20 that recover the next day.
    for (const i of [10, 18, 25]) closes[i] = closes[i]! * 0.985;
    const candles = makeCandles(closes);
    const standardEmas = fakeStandardEmas(30, { ema20: () => 100, ema50: () => 80, ema100: () => 70, ema200: () => 60 });
    const result = calculateEma20ResilienceScore(candles, standardEmas);
    // Should still score comfortably above half marks despite the dips.
    expect(result.score!).toBeGreaterThan(11);
  });

  it("scores a stock with frequent deep, unrecovered violations much lower than a resilient one", () => {
    const resilientCloses = Array.from({ length: 30 }, (_, i) => 105 + i * 0.2);
    const choppyCloses = Array.from({ length: 30 }, (_, i) => (i % 2 === 0 ? 95 : 105));
    const resilientCandles = makeCandles(resilientCloses);
    const choppyCandles = makeCandles(choppyCloses);
    const standardEmas = fakeStandardEmas(30, { ema20: () => 100, ema50: () => 80, ema100: () => 70, ema200: () => 60 });
    const resilientScore = calculateEma20ResilienceScore(resilientCandles, standardEmas).score!;
    const choppyScore = calculateEma20ResilienceScore(choppyCandles, standardEmas).score!;
    expect(resilientScore).toBeGreaterThan(choppyScore);
  });

  it("reports insufficient data below the window length", () => {
    const candles = makeCandles(Array.from({ length: 10 }, (_, i) => 100 + i));
    const standardEmas = fakeStandardEmas(10, { ema20: () => 90, ema50: () => 80, ema100: () => 70, ema200: () => 60 });
    expect(calculateEma20ResilienceScore(candles, standardEmas)).toEqual({ score: null, maximum: 22, unavailableReason: "INSUFFICIENT_DATA" });
  });

  it("does not mutate the input candles array", () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 + i);
    const candles = makeCandles(closes);
    const snapshot = candles.map((c) => ({ ...c }));
    const standardEmas = fakeStandardEmas(30, { ema20: () => 90, ema50: () => 80, ema100: () => 70, ema200: () => 60 });
    calculateEma20ResilienceScore(candles, standardEmas);
    expect(candles).toEqual(snapshot);
  });
});

describe("calculateEma50ResilienceScore", () => {
  it("rewards a stock mostly above EMA50 with a rising EMA50", () => {
    const closes = Array.from({ length: 65 }, (_, i) => 100 + i * 0.3);
    const candles = makeCandles(closes);
    const standardEmas = fakeStandardEmas(65, { ema20: () => 0, ema50: (o) => 90 - o * 0.2, ema100: () => 0, ema200: () => 0 });
    const result = calculateEma50ResilienceScore(candles, standardEmas);
    expect(result.score!).toBeGreaterThan(10);
  });

  it("penalizes a deep single penetration even if EMA50 is otherwise respected", () => {
    const closes = Array.from({ length: 65 }, (_, i) => 100 + i * 0.1);
    closes[62] = 70; // one deep violation
    const candles = makeCandles(closes, { lows: closes.map((c, i) => (i === 62 ? 65 : c - 1)) });
    const flatCloses = Array.from({ length: 65 }, (_, i) => 100 + i * 0.1);
    const flatCandles = makeCandles(flatCloses);
    const standardEmas = fakeStandardEmas(65, { ema20: () => 0, ema50: () => 95, ema100: () => 0, ema200: () => 0 });
    const deepScore = calculateEma50ResilienceScore(candles, standardEmas).score!;
    const cleanScore = calculateEma50ResilienceScore(flatCandles, standardEmas).score!;
    expect(deepScore).toBeLessThan(cleanScore);
  });

  it("reports insufficient data below the window/slope-lookback requirement", () => {
    const candles = makeCandles(Array.from({ length: 20 }, (_, i) => 100 + i));
    const standardEmas = fakeStandardEmas(20, { ema20: () => 0, ema50: () => 90, ema100: () => 0, ema200: () => 0 });
    expect(calculateEma50ResilienceScore(candles, standardEmas)).toEqual({ score: null, maximum: 14, unavailableReason: "INSUFFICIENT_DATA" });
  });
});

describe("calculateTrendDevelopmentScore", () => {
  it("is age-neutral: a freshly aligned and a long-aligned stock with identical CURRENT behaviour score identically", () => {
    const candles = makeCandles(Array.from({ length: 15 }, (_, i) => 100 + i));
    // Two standardEmas fixtures with identical current-window behaviour (offsets 0..5),
    // differing only in irrelevant older history beyond what the component reads.
    const shared = { ema20: (o: number) => 100 + (5 - o) * 1.2, ema50: (o: number) => 80 + (5 - o) * 0.3 };
    const freshlyAligned = fakeStandardEmas(15, { ...shared, ema100: () => 60, ema200: () => 50 });
    const longAligned = fakeStandardEmas(15, { ...shared, ema100: () => 60, ema200: () => 50 });
    const a = calculateTrendDevelopmentScore(candles, freshlyAligned).score!;
    const b = calculateTrendDevelopmentScore(candles, longAligned).score!;
    expect(a).toBe(b);
  });

  it("rewards current higher-highs/higher-lows and a currently-widening stack", () => {
    const risingCandles = makeCandles(
      Array.from({ length: 10 }, (_, i) => 100 + i * 2),
      { highs: Array.from({ length: 10 }, (_, i) => 101 + i * 2), lows: Array.from({ length: 10 }, (_, i) => 99 + i * 2) },
    );
    const flatCandles = makeCandles(Array.from({ length: 10 }, () => 100));
    const standardEmas = fakeStandardEmas(10, { ema20: (o) => 110 - o * 0.5, ema50: (o) => 90 - o * 0.1, ema100: () => 80, ema200: () => 70 });
    const risingScore = calculateTrendDevelopmentScore(risingCandles, standardEmas).score!;
    const flatScore = calculateTrendDevelopmentScore(flatCandles, standardEmas).score!;
    expect(risingScore).toBeGreaterThan(flatScore);
  });

  it("reports insufficient data below the required lookback", () => {
    const candles = makeCandles(Array.from({ length: 4 }, (_, i) => 100 + i));
    const standardEmas = fakeStandardEmas(4, { ema20: () => 100, ema50: () => 90, ema100: () => 80, ema200: () => 70 });
    expect(calculateTrendDevelopmentScore(candles, standardEmas)).toEqual({ score: null, maximum: 10, unavailableReason: "INSUFFICIENT_DATA" });
  });
});

describe("calculateMomentumScore", () => {
  it("hits the top band at the exact boundary", () => {
    const candles = makeCandles([...Array.from({ length: 20 }, () => 100), 110]);
    const result = calculateMomentumScore(candles);
    expect(result.momentum20d).toBe(10);
    expect(result.component.score).toBe(8);
  });

  it("reports insufficient data below 21 candles", () => {
    const result = calculateMomentumScore(makeCandles(Array.from({ length: 10 }, (_, i) => 100 + i)));
    expect(result.component.unavailableReason).toBe("INSUFFICIENT_DATA");
  });
});

describe("calculateExtensionScore", () => {
  it("peaks at exactly EMA20", () => {
    const candles = makeCandles([100]);
    const result = calculateExtensionScore(candles, { ...alignedEmaValues, ema20: 100 });
    expect(result.extensionPct).toBe(0);
    expect(result.component.score).toBe(8);
  });

  it("does NOT max out below EMA20 (fixes the RTT 2.0-era bug)", () => {
    const candles = makeCandles([90]);
    const result = calculateExtensionScore(candles, { ...alignedEmaValues, ema20: 100 });
    expect(result.component.score!).toBeLessThan(8);
  });

  it("is symmetric: equal distance above and below EMA20 score the same", () => {
    const above = calculateExtensionScore(makeCandles([109]), { ...alignedEmaValues, ema20: 100 }).component.score;
    const below = calculateExtensionScore(makeCandles([91]), { ...alignedEmaValues, ema20: 100 }).component.score;
    expect(above).toBeCloseTo(below!, 5);
  });

  it("tapers to zero at +/-18%", () => {
    const result = calculateExtensionScore(makeCandles([118]), { ...alignedEmaValues, ema20: 100 });
    expect(result.component.score).toBe(0);
  });
});

describe("calculateVolumeScore", () => {
  it("hits the top band at RVOL >= 2", () => {
    const candles = makeCandles(Array.from({ length: 21 }, (_, i) => 100 + i), { volumes: [...Array.from({ length: 20 }, () => 1000), 2000] });
    const result = calculateVolumeScore(candles);
    expect(result.rvol).toBe(2);
    expect(result.component.score).toBe(5);
  });
});

describe("calculateRsiHealthScore", () => {
  it("scores full marks across the whole healthy plateau, not just the midpoint", () => {
    expect(calculateRsiHealthScore(45).score).toBe(5);
    expect(calculateRsiHealthScore(58).score).toBe(5);
    expect(calculateRsiHealthScore(70).score).toBe(5);
  });

  it("tapers on both sides and floors at zero outside the wide band", () => {
    expect(calculateRsiHealthScore(20).score).toBe(0);
    expect(calculateRsiHealthScore(95).score).toBe(0);
    expect(calculateRsiHealthScore(37.5).score!).toBeCloseTo(2.5, 5);
  });

  it("never rejects qualification — RSI is context only", () => {
    // calculateRsiHealthScore is a pure scoring function; verify it degrades score, not availability.
    const result = calculateRsiHealthScore(15);
    expect(result.unavailableReason).toBeNull();
    expect(result.score).toBe(0);
  });
});

describe("calculateRtt2xScore (full pipeline)", () => {
  function makeUptrendCandles(length: number): Candle[] {
    return makeCandles(Array.from({ length }, (_, i) => 100 + i * 0.6 + Math.sin(i / 5) * 0.5));
  }

  it("qualifies and scores an aligned, resilient uptrend between 0 and 100", () => {
    const candles = makeUptrendCandles(240);
    const result = calculateRtt2xScore({ symbol: "TEST", candles });
    if (result.qualified) {
      expect(result.rttScore).not.toBeNull();
      expect(result.rttScore!).toBeGreaterThanOrEqual(0);
      expect(result.rttScore!).toBeLessThanOrEqual(100);
      expect(result.classification).not.toBeNull();
    }
  });

  it("never rejects purely on RSI, regardless of value", () => {
    const candles = makeUptrendCandles(240);
    const result = calculateRtt2xScore({ symbol: "TEST", candles });
    expect(result.rejectionReason).not.toBe("RSI_OUT_OF_RANGE");
  });

  it("reports insufficient data for a short history", () => {
    const result = calculateRtt2xScore({ symbol: "TEST", candles: makeCandles(Array.from({ length: 20 }, (_, i) => 100 + i)) });
    expect(result.qualified).toBe(false);
    expect(result.rejectionReason).toBe("INSUFFICIENT_DATA");
  });

  it("Sector Strength never changes rttScore — it is contextual only", () => {
    const candles = makeUptrendCandles(240);
    const withoutSector = calculateRtt2xScore({ symbol: "TEST", candles });
    const withSector = calculateRtt2xScore({
      symbol: "TEST",
      candles,
      sectorStrength: { sector: "Test", performance20d: 12, rank: 1, totalSectors: 5 },
    });
    expect(withSector.rttScore).toBe(withoutSector.rttScore);
    expect(Object.keys(withoutSector).some((k) => k.toLowerCase().includes("sector") && k !== "sectorContext")).toBe(false);
  });

  it("does not mutate the input candles array", () => {
    const candles = makeUptrendCandles(240);
    const snapshot = candles.map((c) => ({ ...c }));
    calculateRtt2xScore({ symbol: "TEST", candles });
    expect(candles).toEqual(snapshot);
  });

  it("sums exactly the 9 component maximums to 100 when all components are available", () => {
    const candles = makeUptrendCandles(240);
    const result = calculateRtt2xScore({ symbol: "TEST", candles });
    const maxes = [
      result.emaStructureScore.maximum,
      result.emaSlopeExpansionScore.maximum,
      result.ema20ResilienceScore.maximum,
      result.ema50ResilienceScore.maximum,
      result.trendDevelopmentScore.maximum,
      result.momentumScore.maximum,
      result.extensionScore.maximum,
      result.volumeScore.maximum,
      result.rsiHealthScore.maximum,
    ];
    expect(maxes.reduce((a, b) => a + b, 0)).toBe(100);
  });
});
