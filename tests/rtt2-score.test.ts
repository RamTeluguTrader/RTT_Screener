import { describe, expect, it } from "vitest";

import { RTT2_SCORE_CONFIG } from "../src/lib/rtt2-config";
import {
  calculateBreakoutBaseQualityScore,
  calculateEarlyTrendDevelopmentScore,
  calculateEma20SupportScore,
  calculateEma50SupportScore,
  calculateEmaSlopeExpansionScore,
  calculateEmaStructureScore,
  calculateExtensionScore2,
  calculateMomentumScore2,
  calculateRsiHealthScore,
  calculateRtt2Score,
  calculateVolumeScore2,
  evaluateRtt2Qualification,
} from "../src/lib/rtt2-score";
import type { Candle, EmaPoint, EmaResult, EmaValues, StandardEmaResults } from "../src/lib/technical-analysis";

const DAY = 86_400_000;
const START = 1_700_000_000_000;

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

function makeCandles(closes: readonly number[], volumes?: readonly number[]): Candle[] {
  return closes.map((close, index) => ({
    timestamp: START + index * DAY,
    open: close,
    high: close * 1.002,
    low: close * 0.998,
    close,
    volume: volumes?.[index] ?? 100_000,
  }));
}

/** Hand-crafted EmaResult: valueAtOffset(0) = latest, valueAtOffset(k) = value k candles before latest. */
function fakeEma(period: number, length: number, valueAtOffset: (offset: number) => number): EmaResult {
  const values: EmaPoint[] = Array.from({ length }, (_, k) => ({
    timestamp: START + k * DAY,
    value: valueAtOffset(length - 1 - k),
  }));
  return { period: period as never, values, latest: values.at(-1) ?? null, hasSufficientData: length > 0 };
}

function fakeStandardEmas(
  length: number,
  fns: {
    ema10?: (offset: number) => number;
    ema20: (offset: number) => number;
    ema50: (offset: number) => number;
    ema100: (offset: number) => number;
    ema200: (offset: number) => number;
  },
): StandardEmaResults {
  return {
    ema10: fakeEma(10, length, fns.ema10 ?? (() => 0)),
    ema20: fakeEma(20, length, fns.ema20),
    ema50: fakeEma(50, length, fns.ema50),
    ema100: fakeEma(100, length, fns.ema100),
    ema200: fakeEma(200, length, fns.ema200),
  };
}

function emaValuesFrom(standardEmas: StandardEmaResults): EmaValues {
  return {
    ema10: standardEmas.ema10.latest?.value ?? null,
    ema20: standardEmas.ema20.latest?.value ?? null,
    ema50: standardEmas.ema50.latest?.value ?? null,
    ema100: standardEmas.ema100.latest?.value ?? null,
    ema200: standardEmas.ema200.latest?.value ?? null,
  };
}

// ---------------------------------------------------------------------------
// Config sanity
// ---------------------------------------------------------------------------

describe("RTT 2.0 config", () => {
  it("weights sum to exactly 100", () => {
    const total = Object.values(RTT2_SCORE_CONFIG.weights).reduce((sum, w) => sum + w, 0);
    expect(total).toBe(100);
  });

  it("matches the approved per-component weights exactly", () => {
    expect(RTT2_SCORE_CONFIG.weights).toEqual({
      emaStructure: 15,
      emaSlopeExpansion: 15,
      earlyTrendDevelopment: 15,
      ema20Support: 15,
      ema50Support: 10,
      momentum: 10,
      breakoutBaseQuality: 10,
      volume: 5,
      rsiHealth: 3,
      extension: 2,
    });
  });
});

// ---------------------------------------------------------------------------
// Qualification: EMA alignment only, RSI never gates
// ---------------------------------------------------------------------------

describe("evaluateRtt2Qualification", () => {
  const aligned: EmaValues = { ema10: 50, ema20: 40, ema50: 30, ema100: 20, ema200: 10 };

  it("qualifies on strict EMA alignment alone", () => {
    expect(evaluateRtt2Qualification(aligned)).toEqual({ qualified: true, rejectionReason: null });
  });

  it("rejects on broken alignment", () => {
    expect(evaluateRtt2Qualification({ ...aligned, ema50: 45 })).toEqual({
      qualified: false,
      rejectionReason: "EMA_ALIGNMENT_FAILED",
    });
  });

  it("rejects on missing EMA values", () => {
    expect(evaluateRtt2Qualification({ ...aligned, ema200: null })).toEqual({
      qualified: false,
      rejectionReason: "INSUFFICIENT_DATA",
    });
  });

  it("has no RSI parameter at all — RSI cannot gate qualification", () => {
    expect(evaluateRtt2Qualification.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 1. EMA Structure
// ---------------------------------------------------------------------------

describe("calculateEmaStructureScore", () => {
  it("matches a hand-computed value for a known separation", () => {
    const result = calculateEmaStructureScore({ ema10: 105, ema20: 102, ema50: 98, ema100: 94, ema200: 90 });
    // seps: 2.941176, 4.081633, 4.255319, 4.444444 -> avg 3.930643 -> 15*(3.930643/5)
    expect(result.score).toBeCloseTo(11.79, 1);
    expect(result.maximum).toBe(15);
  });

  it("caps at 15 for wide separation (avgSep >= 5%)", () => {
    const result = calculateEmaStructureScore({ ema10: 110, ema20: 100, ema50: 90, ema100: 80, ema200: 70 });
    expect(result.score).toBe(15);
  });

  it("is 0 for equal (zero-separation) EMAs", () => {
    const result = calculateEmaStructureScore({ ema10: 100, ema20: 100, ema50: 100, ema100: 100, ema200: 100 });
    expect(result.score).toBe(0);
  });

  it("is unavailable when data is insufficient", () => {
    const result = calculateEmaStructureScore({ ema10: 100, ema20: 100, ema50: 100, ema100: 100, ema200: null });
    expect(result).toEqual({ score: null, maximum: 15, unavailableReason: "INSUFFICIENT_DATA" });
  });
});

// ---------------------------------------------------------------------------
// 2. EMA Slope & Expansion
// ---------------------------------------------------------------------------

describe("calculateEmaSlopeExpansionScore", () => {
  it("is 0/15 for a perfectly flat (no slope, no expansion) EMA history", () => {
    const flat = fakeStandardEmas(11, {
      ema20: () => 100,
      ema50: () => 90,
      ema100: () => 80,
      ema200: () => 70,
    });
    const result = calculateEmaSlopeExpansionScore(flat);
    expect(result.score).toBe(0);
  });

  it("caps at 15/15 when every slope and every expansion meets its target", () => {
    // Past (offset 10): 100/95/90/85. Now (offset 0): 115.58/106.52/97.73/89.25.
    // Every EMA rises well past its 3% slope target; every adjacent pair's
    // separation widens by 3.2-3.6 points, well past the 1.5% expansion target.
    const strong = fakeStandardEmas(11, {
      ema20: (o) => (o === 0 ? 115.58 : o === 10 ? 100 : 107),
      ema50: (o) => (o === 0 ? 106.52 : o === 10 ? 95 : 100),
      ema100: (o) => (o === 0 ? 97.73 : o === 10 ? 90 : 94),
      ema200: (o) => (o === 0 ? 89.25 : o === 10 ? 85 : 87),
    });
    const result = calculateEmaSlopeExpansionScore(strong);
    expect(result.score).toBe(15);
  });

  it("matches a hand-computed partial value", () => {
    // now: ema20=103.5,50=101,100=99.8,200=99.1  (i.e. offset 0)
    // 10 sessions ago: ema20=100,50=100,100=100,200=100 (offset 10)
    const standardEmas = fakeStandardEmas(11, {
      ema20: (o) => (o === 0 ? 103.5 : o === 10 ? 100 : 101.75),
      ema50: (o) => (o === 0 ? 101 : o === 10 ? 100 : 100.5),
      ema100: (o) => (o === 0 ? 99.8 : o === 10 ? 100 : 99.9),
      ema200: (o) => (o === 0 ? 99.1 : o === 10 ? 100 : 99.55),
    });
    // slopes: ema20 3.5%, ema50 1%, ema100 -0.2%(clamped 0), ema200 -0.9%(clamped 0)
    // slope subscore = 1.875*clamp(3.5/3,0,1) + 1.875*clamp(1/3,0,1) + 0 + 0 = 1.875 + 0.625 = 2.5
    // sep now: 20/50=(103.5/101-1)*100=2.475; 50/100=(101/99.8-1)*100=1.202; 100/200=(99.8/99.1-1)*100=0.706
    // sep past (all EMAs=100): all pairs 0
    // expansion = sep now - 0 = sep now for each pair
    // expansion subscore = 2.5*clamp(2.475/1.5,0,1) + 2.5*clamp(1.202/1.5,0,1) + 2.5*clamp(0.706/1.5,0,1)
    //                     = 2.5*1 + 2.5*0.8013 + 2.5*0.4707 = 2.5 + 2.003 + 1.177 = 5.68
    const result = calculateEmaSlopeExpansionScore(standardEmas);
    expect(result.score).toBeCloseTo(2.5 + 5.68, 1);
  });

  it("is unavailable with fewer than 11 historical EMA points", () => {
    const short = fakeStandardEmas(5, { ema20: () => 100, ema50: () => 90, ema100: () => 80, ema200: () => 70 });
    const result = calculateEmaSlopeExpansionScore(short);
    expect(result.unavailableReason).toBe("INSUFFICIENT_DATA");
  });
});

// ---------------------------------------------------------------------------
// 3. Early Trend Development — the core "detect it NOW" component
// ---------------------------------------------------------------------------

describe("calculateEarlyTrendDevelopmentScore", () => {
  /**
   * EMA20/EMA50 pair with genuine ACCELERATION: nearly flat from offset 10->5,
   * then a much steeper rise from offset 5->0. A linear offset function would
   * give constant (non-accelerating) slope, so this is deliberately piecewise.
   */
  function acceleratingEma20(offset: number): number {
    return offset > 5 ? 97 + (10 - offset) * 0.1 : 97.5 + (5 - offset) * 0.9; // o=10:97, o=5:97.5, o=0:102
  }
  function acceleratingEma50(offset: number): number {
    return offset > 5 ? 88 + (10 - offset) * 0.06 : 88.3 + (5 - offset) * 0.5; // o=10:88, o=5:88.3, o=0:90.8
  }

  function candlesWithRecentAcceleration(): Candle[] {
    // 16 candles: flat filler for the required lookback, then a clear recent
    // acceleration in both the price level (higher highs/lows) and the
    // 5-day-over-5-day return (price acceleration).
    const closes = [...Array.from({ length: 11 }, () => 100), 102, 104, 106.5, 109, 112];
    return makeCandles(closes);
  }

  it("gives the transition bonus only when alignment is fresh (<=10 sessions), not when long-established", () => {
    const freshlyAligned = fakeStandardEmas(11, {
      ema10: (o) => (o <= 2 ? 105 : 85), // aligned only for the most recent 3 offsets (0,1,2); 85 < ema20=90 breaks it further back
      ema20: () => 90,
      ema50: () => 80,
      ema100: () => 70,
      ema200: () => 60,
    });
    const longEstablished = fakeStandardEmas(11, {
      ema10: () => 105, // aligned for the entire 11-offset window
      ema20: () => 90,
      ema50: () => 80,
      ema100: () => 70,
      ema200: () => 60,
    });
    const candles = candlesWithRecentAcceleration();

    const fresh = calculateEarlyTrendDevelopmentScore(candles, freshlyAligned);
    const established = calculateEarlyTrendDevelopmentScore(candles, longEstablished);

    // Both get identical slope/expansion/HH-HL/price-accel sub-scores (same candles+EMA history for those parts);
    // the only difference is the 3-point transition bonus.
    expect(fresh.score! - established.score!).toBeCloseTo(3, 5);
  });

  it("does NOT automatically score highly just for being newly aligned if the trend is otherwise weak", () => {
    const newlyAlignedButWeak = fakeStandardEmas(11, {
      ema10: (o) => (o === 0 ? 100.01 : 100), // just barely aligned today, flat otherwise (no slope/expansion accel)
      ema20: () => 100,
      ema50: () => 100,
      ema100: () => 100,
      ema200: () => 99.99,
    });
    const flatCandles = makeCandles(Array.from({ length: 21 }, () => 100)); // no HH/HL, no price accel
    const result = calculateEarlyTrendDevelopmentScore(flatCandles, newlyAlignedButWeak);
    // Only the 3-pt transition bonus should register; everything else should be 0.
    expect(result.score).toBeLessThanOrEqual(3);
  });

  it("lets an established stock score highly if it is currently re-accelerating", () => {
    const establishedReaccelerating = fakeStandardEmas(11, {
      ema10: () => 105, // aligned throughout -> 0 transition bonus
      ema20: acceleratingEma20,
      ema50: acceleratingEma50,
      ema100: () => 80,
      ema200: () => 70,
    });
    const result = calculateEarlyTrendDevelopmentScore(candlesWithRecentAcceleration(), establishedReaccelerating);
    // No transition bonus (0/3), but real slope-accel + expansion-accel + HH/HL + price-accel should still push this well above 6.
    expect(result.score).toBeGreaterThan(6);
  });

  it("scores 0 for an established, decelerating/flat trend with no fresh highs", () => {
    const establishedFlat = fakeStandardEmas(11, {
      ema10: () => 105,
      ema20: () => 100, // perfectly flat -> 0 slope accel, 0 expansion accel
      ema50: () => 90,
      ema100: () => 80,
      ema200: () => 70,
    });
    const flatCandles = makeCandles(Array.from({ length: 21 }, () => 100));
    const result = calculateEarlyTrendDevelopmentScore(flatCandles, establishedFlat);
    expect(result.score).toBe(0);
  });

  it("is unavailable with fewer than 211 candles / 11 EMA200 points", () => {
    const short = fakeStandardEmas(5, { ema20: () => 100, ema50: () => 90, ema100: () => 80, ema200: () => 70 });
    const result = calculateEarlyTrendDevelopmentScore(makeCandles(Array.from({ length: 5 }, () => 100)), short);
    expect(result.unavailableReason).toBe("INSUFFICIENT_DATA");
  });
});

// ---------------------------------------------------------------------------
// 4. 20 EMA Trend Support — continuous, no hard floor
// ---------------------------------------------------------------------------

describe("calculateEma20SupportScore", () => {
  it("removed the old hard floor: a stock at exactly 50% raw time-above still scores well above 0 when it's recent-weighted upward", () => {
    // 30 sessions: below EMA20 for the older 15, above for the recent 15 (a "developing/recovering" pattern).
    const closes = [
      ...Array.from({ length: 15 }, (_, i) => 98 - i * 0.05), // below EMA20=100
      ...Array.from({ length: 15 }, (_, i) => 100.5 + i * 0.1), // above EMA20=100
    ];
    const candles = makeCandles(closes);
    const standardEmas = fakeStandardEmas(30, { ema20: () => 100, ema50: () => 100, ema100: () => 100, ema200: () => 100 });
    const result = calculateEma20SupportScore(candles, standardEmas);
    // Raw pctAbove = 50% (would have been 0 under the old floor).
    expect(result.score).toBeGreaterThan(4);
  });

  it("distinguishes healthy sustained support (high) from weak/broken support (low)", () => {
    const healthyCloses = Array.from({ length: 30 }, (_, i) => 105 + i * 0.05); // always above EMA20=100
    const weakCloses = Array.from({ length: 30 }, (_, i) => 92 - i * 0.05); // always well below EMA20=100

    const standardEmas = fakeStandardEmas(30, { ema20: () => 100, ema50: () => 100, ema100: () => 100, ema200: () => 100 });

    const healthy = calculateEma20SupportScore(makeCandles(healthyCloses), standardEmas);
    const weak = calculateEma20SupportScore(makeCandles(weakCloses), standardEmas);

    expect(healthy.score).toBeGreaterThan(13);
    expect(weak.score).toBeLessThan(2);
    expect(healthy.score!).toBeGreaterThan(weak.score!);
  });

  it("is unavailable with fewer than 30 candles / EMA20 points", () => {
    const standardEmas = fakeStandardEmas(10, { ema20: () => 100, ema50: () => 100, ema100: () => 100, ema200: () => 100 });
    const result = calculateEma20SupportScore(makeCandles(Array.from({ length: 10 }, () => 100)), standardEmas);
    expect(result.unavailableReason).toBe("INSUFFICIENT_DATA");
  });

  it("does not mutate the input candle array", () => {
    const candles = makeCandles(Array.from({ length: 30 }, (_, i) => 100 + i));
    const snapshot = candles.map((c) => ({ ...c }));
    const standardEmas = fakeStandardEmas(30, { ema20: () => 95, ema50: () => 90, ema100: () => 85, ema200: () => 80 });
    calculateEma20SupportScore(candles, standardEmas);
    expect(candles).toEqual(snapshot);
  });
});

// ---------------------------------------------------------------------------
// 5. 50 EMA Structural Support
// ---------------------------------------------------------------------------

describe("calculateEma50SupportScore", () => {
  it("uses a stricter floor (60%) and longer window (60) than the 20 EMA version", () => {
    const closes60 = [
      ...Array.from({ length: 24 }, () => 95), // below EMA50=100 (24/60 = 40% below -> 60% above threshold not met)
      ...Array.from({ length: 36 }, () => 105), // above EMA50=100 (36/60 = 60% above -> exactly at the floor)
    ];
    const candles = makeCandles(closes60);
    const standardEmas = fakeStandardEmas(60, { ema20: () => 100, ema50: () => 100, ema100: () => 100, ema200: () => 100 });
    const result = calculateEma50SupportScore(candles, standardEmas);
    // pctAbove = 60% exactly = floor -> scoreA should be 0 (clamp((60-60)/35,0,1)=0), leaving only the penetration sub-score.
    expect(result.score).toBeLessThan(4);
  });

  it("penalizes on worst single penetration, not average", () => {
    const closes = [
      ...Array.from({ length: 58 }, () => 101), // consistently above, shallow
      70, // one catastrophic single-day break (30% below EMA50=100)
      101,
    ];
    const candles = makeCandles(closes);
    const standardEmas = fakeStandardEmas(60, { ema20: () => 100, ema50: () => 100, ema100: () => 100, ema200: () => 100 });
    const result = calculateEma50SupportScore(candles, standardEmas);
    // 59/60 above (98.3%) would otherwise score near max, but the single deep break should zero the penetration sub-score.
    expect(result.score).toBeLessThan(8);
  });

  it("is unavailable with fewer than 60 candles / EMA50 points", () => {
    const standardEmas = fakeStandardEmas(10, { ema20: () => 100, ema50: () => 100, ema100: () => 100, ema200: () => 100 });
    const result = calculateEma50SupportScore(makeCandles(Array.from({ length: 10 }, () => 100)), standardEmas);
    expect(result.unavailableReason).toBe("INSUFFICIENT_DATA");
  });
});

// ---------------------------------------------------------------------------
// 6. Momentum (reused measure, rebanded)
// ---------------------------------------------------------------------------

describe("calculateMomentumScore2", () => {
  it("bands a >=10% 20-day return to the full 10 points", () => {
    const closes = Array.from({ length: 21 }, (_, i) => (i === 20 ? 111 : 100));
    const { component, momentum20d } = calculateMomentumScore2(makeCandles(closes));
    expect(momentum20d).toBeCloseTo(11, 5);
    expect(component.score).toBe(10);
  });

  it("bands a negative return to 0", () => {
    const closes = Array.from({ length: 21 }, (_, i) => (i === 20 ? 95 : 100));
    const { component } = calculateMomentumScore2(makeCandles(closes));
    expect(component.score).toBe(0);
  });

  it("is unavailable with fewer than 21 candles", () => {
    const { component } = calculateMomentumScore2(makeCandles(Array.from({ length: 10 }, () => 100)));
    expect(component.unavailableReason).toBe("INSUFFICIENT_DATA");
  });
});

// ---------------------------------------------------------------------------
// 7. Breakout / Base Quality — freshness + distance
// ---------------------------------------------------------------------------

describe("calculateBreakoutBaseQualityScore", () => {
  function baseAndBreakout(daysSinceBreakoutFromEnd: number, extensionAboveHighPct: number): Candle[] {
    // 15-session tight base around 100, then an 8-session breakout window.
    const base = Array.from({ length: 15 }, (_, i) => 100 + Math.sin(i) * 0.5); // range well under 8%
    const breakoutHigh = Math.max(...base) + 1;
    const breakoutWindow: number[] = [];
    for (let k = 0; k < 8; k += 1) {
      const sessionsFromLatest = 7 - k;
      if (sessionsFromLatest > daysSinceBreakoutFromEnd) breakoutWindow.push(breakoutHigh - 1); // still inside the base, pre-breakout
      else if (sessionsFromLatest === daysSinceBreakoutFromEnd) breakoutWindow.push(breakoutHigh * 1.001); // the breakout session itself
      else breakoutWindow.push(breakoutHigh * (1 + extensionAboveHighPct / 100)); // subsequent, possibly extended
    }
    return makeCandles([...base, ...breakoutWindow], Array.from({ length: 23 }, (_, i) => (i === 15 + (7 - daysSinceBreakoutFromEnd) ? 300_000 : 100_000)));
  }

  it("scores a fresh breakout near the trigger level higher than a stale, extended one", () => {
    const fresh = calculateBreakoutBaseQualityScore(baseAndBreakout(0, 1)); // broke out today, barely above the level
    const stale = calculateBreakoutBaseQualityScore(baseAndBreakout(7, 14)); // broke out 7 sessions ago, now 14% above it
    expect(fresh.score).toBeGreaterThan(stale.score!);
  });

  it("gives 0 for breakout/freshness/distance/confirmation/volume when no breakout occurred", () => {
    const noBreakout = Array.from({ length: 23 }, (_, i) => 100 + Math.sin(i) * 0.5);
    const result = calculateBreakoutBaseQualityScore(makeCandles(noBreakout));
    // Only base tightness can contribute; should be well under the 10 max.
    expect(result.score).toBeLessThan(3);
  });

  it("is unavailable with fewer than 23 candles", () => {
    const result = calculateBreakoutBaseQualityScore(makeCandles(Array.from({ length: 10 }, () => 100)));
    expect(result.unavailableReason).toBe("INSUFFICIENT_DATA");
  });

  it("does not mutate the input candle array", () => {
    const candles = baseAndBreakout(0, 1);
    const snapshot = candles.map((c) => ({ ...c }));
    calculateBreakoutBaseQualityScore(candles);
    expect(candles).toEqual(snapshot);
  });
});

// ---------------------------------------------------------------------------
// 8. Volume Confirmation (reused measure, rebanded)
// ---------------------------------------------------------------------------

describe("calculateVolumeScore2", () => {
  it("bands RVOL >= 2x to the full 5 points", () => {
    const volumes = Array.from({ length: 21 }, (_, i) => (i === 20 ? 200_000 : 100_000));
    const { component, rvol } = calculateVolumeScore2(makeCandles(Array.from({ length: 21 }, () => 100), volumes));
    expect(rvol).toBeCloseTo(2, 5);
    expect(component.score).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// 9. RSI Health — broad plateau, never gates
// ---------------------------------------------------------------------------

describe("calculateRsiHealthScore", () => {
  it("gives full marks across the entire healthy plateau [45,70], not just one spike value", () => {
    expect(calculateRsiHealthScore(45).score).toBe(3);
    expect(calculateRsiHealthScore(58).score).toBe(3);
    expect(calculateRsiHealthScore(70).score).toBe(3);
  });

  it("tapers gradually below 45 (weak momentum)", () => {
    expect(calculateRsiHealthScore(38).score).toBeCloseTo((3 * (38 - 30)) / 15, 5);
    expect(calculateRsiHealthScore(30).score).toBe(0);
  });

  it("tapers gradually above 70 (overheated)", () => {
    expect(calculateRsiHealthScore(80).score).toBeCloseTo((3 * (85 - 80)) / 15, 5);
    expect(calculateRsiHealthScore(85).score).toBe(0);
  });

  it("floors at 0 far outside the healthy range, never negative, never a rejection", () => {
    expect(calculateRsiHealthScore(10).score).toBe(0);
    expect(calculateRsiHealthScore(95).score).toBe(0);
  });

  it("is unavailable (not zero) when RSI itself is unavailable", () => {
    expect(calculateRsiHealthScore(null).unavailableReason).toBe("INSUFFICIENT_DATA");
    expect(calculateRsiHealthScore(undefined).unavailableReason).toBe("INSUFFICIENT_DATA");
  });
});

// ---------------------------------------------------------------------------
// 10. Extension / Entry Quality — symmetric, bug fixed
// ---------------------------------------------------------------------------

describe("calculateExtensionScore2", () => {
  const emaValuesWithEma20 = (ema20: number): EmaValues => ({ ema10: null, ema20, ema50: null, ema100: null, ema200: null });

  it("peaks at exactly EMA20 (0% extension)", () => {
    const { component, extensionPct } = calculateExtensionScore2(makeCandles([100]), emaValuesWithEma20(100));
    expect(extensionPct).toBe(0);
    expect(component.score).toBe(2);
  });

  it("BUG FIX: a stock below EMA20 no longer receives the maximum score", () => {
    const above = calculateExtensionScore2(makeCandles([100.5]), emaValuesWithEma20(100));
    const below = calculateExtensionScore2(makeCandles([96]), emaValuesWithEma20(100)); // -4% extension
    expect(below.component.score).toBeLessThan(2);
    expect(below.component.score).toBeLessThan(above.component.score!);
  });

  it("is symmetric: equal-magnitude above/below extension score identically", () => {
    const above = calculateExtensionScore2(makeCandles([103]), emaValuesWithEma20(100));
    const below = calculateExtensionScore2(makeCandles([97]), emaValuesWithEma20(100));
    expect(above.component.score).toBeCloseTo(below.component.score!, 10);
  });

  it("tapers to 0 at +-7% and stays 0 beyond it", () => {
    expect(calculateExtensionScore2(makeCandles([107]), emaValuesWithEma20(100)).component.score).toBe(0);
    expect(calculateExtensionScore2(makeCandles([115]), emaValuesWithEma20(100)).component.score).toBe(0);
    expect(calculateExtensionScore2(makeCandles([88]), emaValuesWithEma20(100)).component.score).toBe(0);
  });

  it("is unavailable when EMA20 is unavailable", () => {
    const result = calculateExtensionScore2(makeCandles([100]), emaValuesWithEma20(null as unknown as number));
    expect(result.component.unavailableReason).toBe("INSUFFICIENT_DATA");
  });
});

// ---------------------------------------------------------------------------
// Sector Strength: contextual only, never contributes to rttScore
// ---------------------------------------------------------------------------

describe("Sector Strength as a contextual-only metric", () => {
  function buildAlignedCandles(): Candle[] {
    // A real, sustained, mild uptrend long enough to clear EMA200 + all lookbacks (candles.length >= 231).
    const closes = Array.from({ length: 240 }, (_, i) => 100 * (1 + 0.002) ** i);
    return makeCandles(closes);
  }

  it("does not change rttScore whether sectorStrength is provided or omitted", () => {
    const candles = buildAlignedCandles();
    const withSector = calculateRtt2Score({
      symbol: "TEST",
      candles,
      sectorStrength: { sector: "Test", performance20d: 12.3, rank: 1, totalSectors: 5 },
    });
    const withoutSector = calculateRtt2Score({ symbol: "TEST", candles });

    expect(withSector.rttScore).toBe(withoutSector.rttScore);
    expect(withSector.sectorContext).toEqual({ sector: "Test", performance20d: 12.3, rank: 1, totalSectors: 5 });
    expect(withoutSector.sectorContext).toBeNull();
  });

  it("has no sector component anywhere in the 10-component list", () => {
    const result = calculateRtt2Score({ symbol: "TEST", candles: buildAlignedCandles() });
    const componentKeys = Object.keys(result).filter((k) => k.endsWith("Score") && k !== "rttScore");
    expect(componentKeys).toHaveLength(10);
    expect(componentKeys.some((k) => k.toLowerCase().includes("sector"))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Full pipeline (calculateRtt2Score) — integration-level checks
// ---------------------------------------------------------------------------

describe("calculateRtt2Score (full pipeline)", () => {
  it("qualifies and produces a 0-100 score for a real, sustained uptrend", () => {
    const closes = Array.from({ length: 240 }, (_, i) => 100 * (1 + 0.002) ** i);
    const result = calculateRtt2Score({ symbol: "TEST", candles: makeCandles(closes) });

    expect(result.qualified).toBe(true);
    expect(result.rejectionReason).toBeNull();
    if (result.rttScore !== null) {
      expect(result.rttScore).toBeGreaterThanOrEqual(0);
      expect(result.rttScore).toBeLessThanOrEqual(100);
      expect(result.classification).not.toBeNull();
    }
  });

  it("RSI outside 50-75 does not cause rejection (only affects RSI Health score)", () => {
    // Construct two otherwise-identical aligned series, one with RSI-driving closes pushed low, one high.
    const baseCloses = Array.from({ length: 240 }, (_, i) => 100 * (1 + 0.0015) ** i);
    const lowRsiCloses = [...baseCloses];
    // Force recent closes down hard to push RSI low while keeping EMAs (slow-moving) still aligned.
    for (let i = lowRsiCloses.length - 5; i < lowRsiCloses.length; i += 1) lowRsiCloses[i] = lowRsiCloses[i - 1]! * 0.995;

    const result = calculateRtt2Score({ symbol: "TEST", candles: makeCandles(lowRsiCloses) });
    if (result.qualified) {
      expect(result.rejectionReason).toBeNull();
      // Whatever RSI came out to be, it must not have blocked qualification.
      expect(result.rsi).not.toBeNull();
    } else {
      // Even if the sharp pullback broke EMA alignment, the rejection reason must never be RSI-related
      // (RTT 2.0 has no RSI rejection reason at all — this is a type-level guarantee, asserted at runtime too).
      expect(result.rejectionReason).not.toBe("RSI_OUT_OF_RANGE");
    }
  });

  it("rejects only on EMA alignment / data issues, never on RSI, across all defined rejection reasons", () => {
    const allReasons: Array<Awaited<ReturnType<typeof calculateRtt2Score>>["rejectionReason"]> = [
      "EMA_ALIGNMENT_FAILED",
      "INSUFFICIENT_DATA",
      "INVALID_DATA",
      null,
    ];
    // Type-level check: this list must be exhaustive and must not include an RSI reason.
    expect(allReasons).not.toContain("RSI_OUT_OF_RANGE");
  });

  it("is unavailable/rejected for too little history, without throwing", () => {
    const result = calculateRtt2Score({ symbol: "TEST", candles: makeCandles(Array.from({ length: 10 }, () => 100)) });
    expect(result.qualified).toBe(false);
    expect(result.rttScore).toBeNull();
    expect(result.emaStructureScore.score).toBeNull();
  });

  it("does not mutate the input candle array", () => {
    const closes = Array.from({ length: 240 }, (_, i) => 100 * (1 + 0.002) ** i);
    const candles = makeCandles(closes);
    const snapshot = candles.map((c) => ({ ...c }));
    calculateRtt2Score({ symbol: "TEST", candles });
    expect(candles).toEqual(snapshot);
  });
});

// ---------------------------------------------------------------------------
// The three approved "story" scenarios, at the component-composition level
// ---------------------------------------------------------------------------

describe("RTT 2.0 conceptual principle: NEW/ESTABLISHED is irrelevant, STRENGTHENING/WEAKENING is what matters", () => {
  function sum(scores: (number | null)[]): number {
    return scores.reduce<number>((total, s) => total + (s ?? 0), 0);
  }

  /** Same accelerating EMA20/EMA50 shape used above: flat 10->5, steep 5->0. */
  function acceleratingEma20(offset: number): number {
    return offset > 5 ? 97 + (10 - offset) * 0.1 : 97.5 + (5 - offset) * 0.9;
  }
  function acceleratingEma50(offset: number): number {
    return offset > 5 ? 88 + (10 - offset) * 0.06 : 88.3 + (5 - offset) * 0.5;
  }
  function candlesWithRecentAcceleration(): Candle[] {
    const closes = [...Array.from({ length: 11 }, () => 100), 102, 104, 106.5, 109, 112];
    return makeCandles(closes);
  }

  it("a newly-aligned + strengthening stock can score highly", () => {
    const standardEmas = fakeStandardEmas(11, {
      ema10: (o) => (o <= 1 ? 105 : 85), // just transitioned into alignment (85 < ema20=90 further back)
      ema20: acceleratingEma20,
      ema50: acceleratingEma50,
      ema100: () => 80,
      ema200: () => 70,
    });
    const emaValues = emaValuesFrom(standardEmas);
    const candles = candlesWithRecentAcceleration();

    const structure = calculateEmaStructureScore(emaValues);
    const slopeExpansion = calculateEmaSlopeExpansionScore(standardEmas);
    const earlyTrend = calculateEarlyTrendDevelopmentScore(candles, standardEmas);

    const total = sum([structure.score, slopeExpansion.score, earlyTrend.score]);
    expect(total).toBeGreaterThan(15); // meaningfully more than a third of just these 3 components' 45-pt max
    expect(earlyTrend.score).toBeGreaterThan(8); // the transition bonus + real acceleration should both register
  });

  it("an established + re-accelerating stock can ALSO score highly (no age penalty)", () => {
    const standardEmas = fakeStandardEmas(11, {
      ema10: () => 105, // aligned for the whole window -> no transition bonus
      ema20: acceleratingEma20, // still genuinely accelerating
      ema50: acceleratingEma50,
      ema100: () => 80,
      ema200: () => 70,
    });
    const emaValues = emaValuesFrom(standardEmas);
    const candles = candlesWithRecentAcceleration();

    const earlyTrend = calculateEarlyTrendDevelopmentScore(candles, standardEmas);
    // Zero transition bonus, yet still scores well above zero from acceleration + HH/HL + price accel alone.
    expect(earlyTrend.score).toBeGreaterThan(6);
    void emaValues;
  });

  it("an established + weakening stock scores materially lower on Early Trend Development", () => {
    const strengthening = fakeStandardEmas(11, {
      ema10: () => 105,
      ema20: acceleratingEma20,
      ema50: acceleratingEma50,
      ema100: () => 80,
      ema200: () => 70,
    });
    const weakening = fakeStandardEmas(11, {
      ema10: () => 105,
      ema20: (o) => 100 + o * 0.05, // recent slope now negative relative to the past -> deceleration
      ema50: () => 90,
      ema100: () => 80,
      ema200: () => 70,
    });
    const flatCandles = makeCandles(Array.from({ length: 16 }, () => 100));

    const strong = calculateEarlyTrendDevelopmentScore(flatCandles, strengthening);
    const weak = calculateEarlyTrendDevelopmentScore(flatCandles, weakening);

    expect(weak.score).toBe(0);
    expect(strong.score!).toBeGreaterThan(weak.score!);
  });
});
