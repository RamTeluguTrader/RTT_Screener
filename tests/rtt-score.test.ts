import { describe, expect, it } from "vitest";

import {
  calculateExtensionScore,
  calculateHighProximityScore,
  calculateMomentumScore,
  calculatePriceVsEmaScore,
  calculateRttScore,
  calculateSectorScore,
  calculateSectorStrengths,
  calculateVolumeScore,
  classifyRttScore,
  evaluateRttQualification,
  type RttScoreInput,
} from "../src/lib/rtt-score";
import type { Candle, EmaValues } from "../src/lib/technical-analysis";

const alignedEmaValues: EmaValues = { ema10: 120, ema20: 115, ema50: 108, ema100: 100, ema200: 90 };

function makeCandles(count: number, latestClose = 304, latestVolume = 2_000): Candle[] {
  const startClose = latestClose - (count - 1);
  return Array.from({ length: count }, (_, index) => {
    const close = index === count - 1 ? latestClose : startClose + index;
    return {
      timestamp: 1_700_000_000_000 + index * 86_400_000,
      open: close - 1,
      high: close + 2,
      low: close - 3,
      close,
      volume: index === count - 1 ? latestVolume : 1_000,
    };
  });
}

function momentumCandles(returnPercent: number): Candle[] {
  const candles = makeCandles(21, 100 * (1 + returnPercent / 100), 1_000);
  candles[0] = { ...candles[0]!, close: 100 };
  return candles;
}

function qualifiedInput(overrides: Partial<RttScoreInput> = {}): RttScoreInput {
  return {
    symbol: "FIXTURE",
    candles: makeCandles(205),
    rsi14: 60,
    high52Week: 305,
    sectorStrength: { sector: "Fixture Sector", performance20d: 8, rank: 1, totalSectors: 10 },
    ...overrides,
  };
}

describe("RTT qualification", () => {
  it("qualifies strictly aligned EMAs with an in-range RSI", () => {
    expect(evaluateRttQualification(alignedEmaValues, 60)).toEqual({ qualified: true, rejectionReason: null });
  });

  it.each([
    ["EMA10 <= EMA20", { ...alignedEmaValues, ema10: 115 }],
    ["EMA20 <= EMA50", { ...alignedEmaValues, ema20: 108 }],
    ["EMA50 <= EMA100", { ...alignedEmaValues, ema50: 100 }],
    ["EMA100 <= EMA200", { ...alignedEmaValues, ema100: 90 }],
  ])("rejects when %s", (_, emaValues) => {
    expect(evaluateRttQualification(emaValues, 60)).toMatchObject({ qualified: false, rejectionReason: "EMA_ALIGNMENT_FAILED" });
  });

  it.each([
    [49.99, "RSI_OUT_OF_RANGE"],
    [50, null],
    [75, null],
    [75.01, "RSI_OUT_OF_RANGE"],
  ])("enforces the RSI range at %d", (rsi, rejectionReason) => {
    expect(evaluateRttQualification(alignedEmaValues, rsi).rejectionReason).toBe(rejectionReason);
  });

  it("reports insufficient data when an EMA value is missing", () => {
    expect(evaluateRttQualification({ ...alignedEmaValues, ema50: null }, 60).rejectionReason).toBe("INSUFFICIENT_DATA");
  });
});

describe("RTT score components", () => {
  it("awards 15/15 only when price is above every EMA", () => {
    expect(calculatePriceVsEmaScore(130, alignedEmaValues).score).toBe(15);
    expect(calculatePriceVsEmaScore(110, alignedEmaValues).score).toBe(7);
  });

  it.each([
    [10, 20],
    [7.5, 16],
    [5, 12],
    [2.5, 8],
    [0, 4],
    [-1, 0],
  ])("scores %d%% 20-day momentum as %d", (returnPercent, expectedScore) => {
    expect(calculateMomentumScore(momentumCandles(returnPercent)).component.score).toBe(expectedScore);
  });

  it.each([
    [2, 15],
    [1.5, 12],
    [1.25, 9],
    [1, 6],
    [0.75, 3],
    [0.74, 0],
  ])("scores RVOL %f as %d", (rvol, expectedScore) => {
    expect(calculateVolumeScore(makeCandles(21, 120, 1_000 * rvol)).component.score).toBe(expectedScore);
  });

  it.each([
    [102, 5],
    [105, 4],
    [110, 3],
    [115, 2],
    [125, 1],
    [134, 0],
  ])("scores 52-week high %d as %d", (high, expectedScore) => {
    expect(calculateHighProximityScore(100, high).component.score).toBe(expectedScore);
  });

  it.each([
    [100, 100, 10],
    [103, 100, 10],
    [105, 100, 8],
    [108, 100, 6],
    [112, 100, 3],
    [113, 100, 0],
    [99, 100, 10],
  ])("scores price %d against EMA20 %d as %d", (price, ema20, expectedScore) => {
    expect(calculateExtensionScore(price, ema20).component.score).toBe(expectedScore);
  });

  it("scores sector rank and ranks sectors from available member histories", () => {
    expect(calculateSectorScore({ sector: "A", performance20d: 10, rank: 1, totalSectors: 10 }).score).toBe(15);
    expect(calculateSectorScore({ sector: "A", performance20d: -5, rank: 10, totalSectors: 10 }).score).toBe(0);
    const strengths = calculateSectorStrengths([
      { sector: "Auto", members: [{ symbol: "A", candles: momentumCandles(10) }] },
      { sector: "IT", members: [{ symbol: "I", candles: momentumCandles(5) }] },
    ]);
    expect(strengths.map((strength) => strength.sector)).toEqual(["Auto", "IT"]);
  });

  it.each([
    [90, "Exceptional"],
    [80, "Strong"],
    [70, "Good"],
    [60, "Watch"],
    [59.99, "Weak"],
  ])("classifies score %d as %s", (score, classification) => {
    expect(classifyRttScore(score)).toBe(classification);
  });
});

describe("RTT score data quality and pipeline", () => {
  it("returns a complete, bounded score for a qualified fixture", () => {
    const result = calculateRttScore(qualifiedInput());

    expect(result.qualified).toBe(true);
    expect(result.rttScore).not.toBeNull();
    expect(result.rttScore!).toBeGreaterThanOrEqual(0);
    expect(result.rttScore!).toBeLessThanOrEqual(100);
    expect(result.classification).not.toBeNull();
  });

  it("does not score rejected or incomplete qualification data", () => {
    expect(calculateRttScore(qualifiedInput({ rsi14: 49 })).rejectionReason).toBe("RSI_OUT_OF_RANGE");
    expect(calculateRttScore(qualifiedInput({ rsi14: undefined })).rejectionReason).toBe("INSUFFICIENT_DATA");
    expect(calculateRttScore(qualifiedInput({ candles: makeCandles(199) })).rejectionReason).toBe("INSUFFICIENT_DATA");
  });

  it("marks absent score inputs as unavailable instead of fabricating a total", () => {
    const result = calculateRttScore(qualifiedInput({ high52Week: undefined, sectorStrength: undefined }));

    expect(result.qualified).toBe(true);
    expect(result.rttScore).toBeNull();
    expect(result.highProximityScore.unavailableReason).toBe("INSUFFICIENT_DATA");
    expect(result.sectorScore.unavailableReason).toBe("INSUFFICIENT_DATA");
  });

  it("rejects invalid candles, RSI values, and score inputs", () => {
    const invalidCandles = makeCandles(205).map((candle, index) => index === 0 ? { ...candle, close: Number.NaN } : candle);
    expect(calculateRttScore(qualifiedInput({ candles: invalidCandles })).rejectionReason).toBe("INVALID_DATA");
    expect(calculateRttScore(qualifiedInput({ rsi14: Number.NaN })).rejectionReason).toBe("INVALID_DATA");
    const result = calculateRttScore(qualifiedInput({ high52Week: Number.NaN }));
    expect(result.highProximityScore.unavailableReason).toBe("INVALID_DATA");
  });

  it("reports insufficient history for momentum and volume helpers", () => {
    expect(calculateMomentumScore(makeCandles(20)).component.unavailableReason).toBe("INSUFFICIENT_DATA");
    expect(calculateVolumeScore(makeCandles(20)).component.unavailableReason).toBe("INSUFFICIENT_DATA");
  });

  it("reports missing volume as invalid data", () => {
    const candles = makeCandles(21);
    Reflect.deleteProperty(candles.at(-1)!, "volume");

    expect(calculateVolumeScore(candles).component.unavailableReason).toBe("INVALID_DATA");
  });
});
