import { describe, expect, it } from "vitest";

import {
  calculateEma,
  calculateRsi,
  calculateStandardEmas,
  getLatestEmaValues,
  getLatestRsiValue,
  isEmaAligned,
  RSI_PERIOD,
  type Candle,
  type EmaValues,
} from "../src/lib/technical-analysis";

function makeCandles(closes: readonly number[]): Candle[] {
  return closes.map((close, index) => ({
    timestamp: 1_700_000_000_000 + index * 60_000,
    open: close,
    high: close + 1,
    low: close - 1,
    close,
    volume: 1_000 + index,
  }));
}

const alignedValues: EmaValues = {
  ema10: 50,
  ema20: 40,
  ema50: 30,
  ema100: 20,
  ema200: 10,
};

describe("technical analysis EMA engine", () => {
  it("returns an insufficient-data result without an EMA value", () => {
    const result = calculateEma(makeCandles([1, 2, 3, 4, 5, 6, 7, 8, 9]), 10);

    expect(result).toEqual({ period: 10, values: [], latest: null, hasSufficientData: false });
  });

  it("calculates an EMA from closing prices using an SMA seed", () => {
    const result = calculateEma(makeCandles([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]), 10);

    expect(result.hasSufficientData).toBe(true);
    expect(result.values).toHaveLength(2);
    expect(result.values[0]?.value).toBe(5.5);
    expect(result.latest?.value).toBeCloseTo(6.5, 12);
  });

  it("calculates all standard EMA periods independently", () => {
    const results = calculateStandardEmas(makeCandles(Array.from({ length: 200 }, (_, index) => index + 1)));

    expect(results.ema10.hasSufficientData).toBe(true);
    expect(results.ema200.hasSufficientData).toBe(true);
    expect(getLatestEmaValues(results).ema10).not.toBeNull();
  });

  it("returns true for strictly aligned EMAs", () => {
    expect(isEmaAligned(alignedValues)).toBe(true);
  });

  it("returns false when the EMA order is broken", () => {
    expect(isEmaAligned({ ...alignedValues, ema50: 45 })).toBe(false);
  });

  it("returns false when any EMA values are equal", () => {
    expect(isEmaAligned({ ...alignedValues, ema20: 50 })).toBe(false);
  });

  it("rejects missing, non-finite, and invalid numerical candle values", () => {
    const candles = makeCandles(Array.from({ length: 10 }, (_, index) => index + 1));
    const missingClose = makeCandles(Array.from({ length: 10 }, (_, index) => index + 1));
    const nonFiniteClose = candles.map((candle) => ({ ...candle, close: Number.NaN }));
    const negativeVolume = candles.map((candle) => ({ ...candle, volume: -1 }));

    Reflect.deleteProperty(missingClose[0]!, "close");

    expect(() => calculateEma(missingClose, 10)).toThrow("close must be a finite number");
    expect(() => calculateEma(nonFiniteClose, 10)).toThrow("close must be a finite number");
    expect(() => calculateEma(negativeVolume, 10)).toThrow("volume must not be negative");
  });
});

// Expected values below were derived from an independent Wilder RSI(14) reference
// implementation (written separately from src/lib/technical-analysis.ts, using the
// same textbook formula), not by re-running the function under test on itself.
describe("technical analysis RSI engine", () => {
  it("matches a known, independently-computed RSI(14) value for a deterministic 15-close series", () => {
    const closes = [100, 101, 102, 101, 103, 104, 103, 105, 106, 105, 107, 108, 107, 109, 110];
    const result = calculateRsi(makeCandles(closes), RSI_PERIOD);

    expect(result.hasSufficientData).toBe(true);
    expect(result.values).toHaveLength(1);
    // Average gain = 10/14, average loss = 1/14 -> RSI = 100 - 100/(1 + 10) = 700/9.
    expect(result.latest?.value).toBeCloseTo(700 / 9, 9);
  });

  it("returns RSI 100 for a strictly rising series (all gains, no losses)", () => {
    const closes = Array.from({ length: 16 }, (_, index) => 100 + index);
    const result = calculateRsi(makeCandles(closes), RSI_PERIOD);

    expect(result.values.map((point) => point.value)).toEqual([100, 100]);
  });

  it("returns RSI 0 for a strictly falling series (all losses, no gains)", () => {
    const closes = Array.from({ length: 16 }, (_, index) => 100 - index);
    const result = calculateRsi(makeCandles(closes), RSI_PERIOD);

    expect(result.values.map((point) => point.value)).toEqual([0, 0]);
  });

  it("calculates RSI across a mixed gains/losses series, matching the independent reference exactly", () => {
    const closes = [
      50, 50.5, 50.2, 50.8, 50.6, 51.1, 50.9, 51.4, 51.0, 51.6, 51.3, 51.9, 51.5, 52.1, 51.8, 52.4, 52.0, 52.6, 52.3,
      52.9,
    ];
    const result = calculateRsi(makeCandles(closes), RSI_PERIOD);
    const expected = [
      64.99999999999997, 68.40277777777777, 63.939747003994675, 67.37803465530024, 64.08768025545933,
      67.50549802257578,
    ];

    expect(result.values).toHaveLength(expected.length);
    result.values.forEach((point, index) => {
      expect(point.value).toBeCloseTo(expected[index]!, 9);
    });
  });

  it("reports insufficient data below period + 1 candles", () => {
    const result = calculateRsi(makeCandles(Array.from({ length: 14 }, (_, index) => index + 1)), RSI_PERIOD);

    expect(result).toEqual({ period: 14, values: [], latest: null, hasSufficientData: false });
  });

  it("reports a neutral RSI of 50 for a perfectly constant price series", () => {
    const result = calculateRsi(makeCandles(Array.from({ length: 16 }, () => 100)), RSI_PERIOD);

    expect(result.values.map((point) => point.value)).toEqual([50, 50]);
  });

  it("rejects missing, non-finite, and invalid numerical candle values, matching the EMA engine's behavior", () => {
    const candles = makeCandles(Array.from({ length: 16 }, (_, index) => index + 1));
    const missingClose = makeCandles(Array.from({ length: 16 }, (_, index) => index + 1));
    const nonFiniteClose = candles.map((candle) => ({ ...candle, close: Number.NaN }));
    const negativeVolume = candles.map((candle) => ({ ...candle, volume: -1 }));

    Reflect.deleteProperty(missingClose[0]!, "close");

    expect(() => calculateRsi(missingClose, RSI_PERIOD)).toThrow("close must be a finite number");
    expect(() => calculateRsi(nonFiniteClose, RSI_PERIOD)).toThrow("close must be a finite number");
    expect(() => calculateRsi(negativeVolume, RSI_PERIOD)).toThrow("volume must not be negative");
  });

  it("does not mutate the input candle array", () => {
    const candles = makeCandles(Array.from({ length: 16 }, (_, index) => 100 + index));
    const snapshot = candles.map((candle) => ({ ...candle }));

    calculateRsi(candles, RSI_PERIOD);

    expect(candles).toEqual(snapshot);
  });

  it("extracts the latest RSI14 value via getLatestRsiValue, mirroring getLatestEmaValues", () => {
    const sufficient = calculateRsi(makeCandles(Array.from({ length: 20 }, (_, index) => 100 + index)), RSI_PERIOD);
    const insufficient = calculateRsi(makeCandles([1, 2, 3]), RSI_PERIOD);

    expect(getLatestRsiValue(sufficient)).toBe(sufficient.latest?.value);
    expect(getLatestRsiValue(sufficient)).not.toBeNull();
    expect(getLatestRsiValue(insufficient)).toBeNull();
  });
});
