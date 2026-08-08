import { describe, expect, it } from "vitest";

import {
  calculateEma,
  calculateStandardEmas,
  getLatestEmaValues,
  isEmaAligned,
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
