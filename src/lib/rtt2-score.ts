import { RTT2_SCORE_CONFIG } from "./rtt2-config";
import {
  classifyRttScore,
  type RttClassification,
  type ScoreComponent,
  type SectorStrength,
} from "./rtt-score";
import {
  calculateRsi,
  calculateStandardEmas,
  getLatestEmaValues,
  getLatestRsiValue,
  isEmaAligned,
  type Candle,
  type EmaResult,
  type EmaValues,
  type StandardEmaResults,
} from "./technical-analysis";

/**
 * RTT 2.0 scoring engine — a parallel, independent model to RTT 1.0
 * (rtt-score.ts), built from the approved design. RTT 1.0 is not modified by
 * this file; both can be run side by side for comparison.
 *
 * Qualification: EMA alignment (10>20>50>100>200) is the ONLY hard gate.
 * RSI is never a gate — it contributes only to the RSI Health score.
 * Sector Strength is a separate contextual field on the result and never
 * contributes to the 100-point rttScore.
 */

export type Rtt2RejectionReason = "EMA_ALIGNMENT_FAILED" | "INSUFFICIENT_DATA" | "INVALID_DATA";

export type Rtt2QualificationResult =
  | { qualified: true; rejectionReason: null }
  | { qualified: false; rejectionReason: Rtt2RejectionReason };

export type Rtt2ScoreInput = {
  symbol: string;
  candles: readonly Candle[];
  /** Contextual only — never added into rttScore. */
  sectorStrength?: SectorStrength;
};

export type Rtt2ScoreResult = {
  symbol: string;
  qualified: boolean;
  rejectionReason: Rtt2RejectionReason | null;
  rttScore: number | null;
  classification: RttClassification | null;
  emaStructureScore: ScoreComponent;
  emaSlopeExpansionScore: ScoreComponent;
  earlyTrendDevelopmentScore: ScoreComponent;
  ema20SupportScore: ScoreComponent;
  ema50SupportScore: ScoreComponent;
  momentumScore: ScoreComponent;
  breakoutBaseQualityScore: ScoreComponent;
  volumeScore: ScoreComponent;
  rsiHealthScore: ScoreComponent;
  extensionScore: ScoreComponent;
  rsi: number | null;
  momentum20d: number | null;
  rvol: number | null;
  extensionPct: number | null;
  /** Contextual only — informational, never included in rttScore. */
  sectorContext: SectorStrength | null;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundPercent(value: number): number {
  return Math.round(value * 100_000_000) / 100_000_000;
}

function unavailable(maximum: number, reason: "INSUFFICIENT_DATA" | "INVALID_DATA"): ScoreComponent {
  return { score: null, maximum, unavailableReason: reason };
}

function available(maximum: number, score: number): ScoreComponent {
  return { score: roundScore(score), maximum, unavailableReason: null };
}

function bandScore(value: number, bands: readonly { minimumPercent?: number; minimum?: number; score: number }[]): number {
  return bands.find((band) => value >= (band.minimumPercent ?? band.minimum ?? Number.POSITIVE_INFINITY))!.score;
}

/** Reads the EMA value `offset` candles before the latest one, or null if unavailable. */
function valueAtOffset(result: EmaResult, offset: number): number | null {
  const index = result.values.length - 1 - offset;
  return index >= 0 ? result.values[index]!.value : null;
}

/** Builds an EmaValues snapshot at a historical offset from the latest candle (0 = latest). */
function emaValuesAtOffset(standardEmas: StandardEmaResults, offset: number): EmaValues {
  return {
    ema10: valueAtOffset(standardEmas.ema10, offset),
    ema20: valueAtOffset(standardEmas.ema20, offset),
    ema50: valueAtOffset(standardEmas.ema50, offset),
    ema100: valueAtOffset(standardEmas.ema100, offset),
    ema200: valueAtOffset(standardEmas.ema200, offset),
  };
}

export function evaluateRtt2Qualification(emaValues: EmaValues): Rtt2QualificationResult {
  const values = [emaValues.ema10, emaValues.ema20, emaValues.ema50, emaValues.ema100, emaValues.ema200];
  if (values.some((value) => value === null)) return { qualified: false, rejectionReason: "INSUFFICIENT_DATA" };
  if (!values.every(isFiniteNumber)) return { qualified: false, rejectionReason: "INVALID_DATA" };
  if (!isEmaAligned(emaValues)) return { qualified: false, rejectionReason: "EMA_ALIGNMENT_FAILED" };
  return { qualified: true, rejectionReason: null };
}

// ---------------------------------------------------------------------------
// 1. EMA Structure — 15 pts. Same algorithm as RTT 1.0's emaStack, reweighted.
// ---------------------------------------------------------------------------
export function calculateEmaStructureScore(emaValues: EmaValues): ScoreComponent {
  const { weights, emaStructure } = RTT2_SCORE_CONFIG;
  const values = [emaValues.ema10, emaValues.ema20, emaValues.ema50, emaValues.ema100, emaValues.ema200];
  if (values.some((value) => value === null)) return unavailable(weights.emaStructure, "INSUFFICIENT_DATA");
  if (!values.every(isFiniteNumber)) return unavailable(weights.emaStructure, "INVALID_DATA");

  const seps = values.slice(0, -1).map((value, index) => (value / values[index + 1]! - 1) * 100);
  const avgSep = seps.reduce((total, value) => total + value, 0) / seps.length;
  const score = clamp01(avgSep / emaStructure.targetAverageSeparationPercent) * weights.emaStructure;
  return available(weights.emaStructure, score);
}

// ---------------------------------------------------------------------------
// 2. EMA Slope & Expansion — 15 pts (7.5 slope + 7.5 expansion). EMA20/50/100/200.
// ---------------------------------------------------------------------------
const SLOPE_EXPANSION_EMAS = ["ema20", "ema50", "ema100", "ema200"] as const;
const SLOPE_EXPANSION_PAIRS = [
  ["ema20", "ema50"],
  ["ema50", "ema100"],
  ["ema100", "ema200"],
] as const;

export function calculateEmaSlopeExpansionScore(standardEmas: StandardEmaResults): ScoreComponent {
  const { weights, slopeExpansion } = RTT2_SCORE_CONFIG;
  const L = slopeExpansion.lookback;

  const nowValues: Record<string, number | null> = {};
  const pastValues: Record<string, number | null> = {};
  for (const period of SLOPE_EXPANSION_EMAS) {
    nowValues[period] = standardEmas[period].latest?.value ?? null;
    pastValues[period] = valueAtOffset(standardEmas[period], L);
  }

  const allValues = [...Object.values(nowValues), ...Object.values(pastValues)];
  if (allValues.some((value) => value === null)) return unavailable(weights.emaSlopeExpansion, "INSUFFICIENT_DATA");
  if (!allValues.every(isFiniteNumber)) return unavailable(weights.emaSlopeExpansion, "INVALID_DATA");

  const perEmaMax = slopeExpansion.slopePointsMax / SLOPE_EXPANSION_EMAS.length;
  let slopeSubscore = 0;
  for (const period of SLOPE_EXPANSION_EMAS) {
    const slope = (nowValues[period]! / pastValues[period]! - 1) * 100;
    slopeSubscore += perEmaMax * clamp01(slope / slopeExpansion.slopeTargetPercent);
  }

  const perPairMax = slopeExpansion.expansionPointsMax / SLOPE_EXPANSION_PAIRS.length;
  let expansionSubscore = 0;
  for (const [shortP, longP] of SLOPE_EXPANSION_PAIRS) {
    const sepNow = (nowValues[shortP]! / nowValues[longP]! - 1) * 100;
    const sepPast = (pastValues[shortP]! / pastValues[longP]! - 1) * 100;
    const expansion = sepNow - sepPast;
    expansionSubscore += perPairMax * clamp01(expansion / slopeExpansion.expansionTargetPercent);
  }

  return available(weights.emaSlopeExpansion, slopeSubscore + expansionSubscore);
}

// ---------------------------------------------------------------------------
// 3. Early Trend Development — 15 pts. Acceleration-based, not age-based.
// ---------------------------------------------------------------------------
export function calculateEarlyTrendDevelopmentScore(
  candles: readonly Candle[],
  standardEmas: StandardEmaResults,
): ScoreComponent {
  const { weights, earlyTrendDevelopment: cfg } = RTT2_SCORE_CONFIG;
  const maxOffsetNeeded = Math.max(cfg.transitionLookback, cfg.slopeAccelWindow * 2, cfg.expansionAccelWindow * 2, cfg.priceAccelWindow * 2);

  if (standardEmas.ema200.values.length < maxOffsetNeeded + 1 || candles.length < maxOffsetNeeded + 1) {
    return unavailable(weights.earlyTrendDevelopment, "INSUFFICIENT_DATA");
  }

  const emaNow = emaValuesAtOffset(standardEmas, 0);
  const requiredOffsets = [0, cfg.slopeAccelWindow, cfg.slopeAccelWindow * 2];
  for (const offset of requiredOffsets) {
    const snapshot = emaValuesAtOffset(standardEmas, offset);
    if (Object.values(snapshot).some((v) => v === null)) return unavailable(weights.earlyTrendDevelopment, "INSUFFICIENT_DATA");
    if (!Object.values(snapshot).every(isFiniteNumber)) return unavailable(weights.earlyTrendDevelopment, "INVALID_DATA");
  }

  // A. Alignment-transition bonus.
  let transitionScore = 0;
  if (isEmaAligned(emaNow)) {
    let streak = 0;
    while (streak <= cfg.transitionLookback && isEmaAligned(emaValuesAtOffset(standardEmas, streak))) {
      streak += 1;
    }
    if (streak <= cfg.transitionLookback) transitionScore = cfg.transitionPoints;
  }

  // B. EMA20 slope acceleration.
  const ema20 = standardEmas.ema20;
  const ema20Now = valueAtOffset(ema20, 0)!;
  const ema20Mid = valueAtOffset(ema20, cfg.slopeAccelWindow)!;
  const ema20Past = valueAtOffset(ema20, cfg.slopeAccelWindow * 2)!;
  const recentSlope = (ema20Now / ema20Mid - 1) * 100;
  const priorSlope = (ema20Mid / ema20Past - 1) * 100;
  const slopeAccel = recentSlope - priorSlope;
  const slopeAccelScore = cfg.slopeAccelPoints * clamp01(slopeAccel / cfg.slopeAccelTargetPercent);

  // C. EMA20/EMA50 separation-expansion acceleration.
  const ema50 = standardEmas.ema50;
  const sepAt = (offset: number) => (valueAtOffset(ema20, offset)! / valueAtOffset(ema50, offset)! - 1) * 100;
  const recentExpansion = sepAt(0) - sepAt(cfg.expansionAccelWindow);
  const priorExpansion = sepAt(cfg.expansionAccelWindow) - sepAt(cfg.expansionAccelWindow * 2);
  const expansionAccel = recentExpansion - priorExpansion;
  const expansionAccelScore = cfg.expansionAccelPoints * clamp01(expansionAccel / cfg.expansionAccelTargetPercent);

  // D. Higher-highs / higher-lows over the last 10 sessions (two 5-session halves).
  const hhhlWindow = candles.slice(-cfg.hhhlWindow);
  const half = cfg.hhhlWindow / 2;
  const olderHalf = hhhlWindow.slice(0, half);
  const recentHalf = hhhlWindow.slice(half);
  const higherHigh = Math.max(...recentHalf.map((c) => c.high)) > Math.max(...olderHalf.map((c) => c.high));
  const higherLow = Math.min(...recentHalf.map((c) => c.low)) > Math.min(...olderHalf.map((c) => c.low));
  const hhhlScore = (higherHigh ? cfg.hhhlPoints / 2 : 0) + (higherLow ? cfg.hhhlPoints / 2 : 0);

  // E. Price acceleration (raw close, independent of EMAs).
  const closeAt = (offset: number) => candles[candles.length - 1 - offset]!.close;
  const recentReturn = (closeAt(0) / closeAt(cfg.priceAccelWindow) - 1) * 100;
  const priorReturn = (closeAt(cfg.priceAccelWindow) / closeAt(cfg.priceAccelWindow * 2) - 1) * 100;
  const priceAccel = recentReturn - priorReturn;
  const priceAccelScore = cfg.priceAccelPoints * clamp01(priceAccel / cfg.priceAccelTargetPercent);

  return available(
    weights.earlyTrendDevelopment,
    transitionScore + slopeAccelScore + expansionAccelScore + hhhlScore + priceAccelScore,
  );
}

// ---------------------------------------------------------------------------
// 4. 20 EMA Trend Support — 15 pts. Continuous, recency-weighted, no hard floor.
// ---------------------------------------------------------------------------
export function calculateEma20SupportScore(candles: readonly Candle[], standardEmas: StandardEmaResults): ScoreComponent {
  const { weights, ema20Support: cfg } = RTT2_SCORE_CONFIG;
  const W = cfg.window;
  const ema20 = standardEmas.ema20;

  if (ema20.values.length < W || candles.length < W) return unavailable(weights.ema20Support, "INSUFFICIENT_DATA");

  const windowCandles = candles.slice(-W);
  const windowEma = ema20.values.slice(-W);
  if (windowEma.some((p) => !isFiniteNumber(p.value)) || windowCandles.some((c) => !isFiniteNumber(c.close))) {
    return unavailable(weights.ema20Support, "INVALID_DATA");
  }

  // A. Recency-weighted % of closes above EMA20 (weight 1..W, oldest..newest).
  let weightedSum = 0;
  let totalWeight = 0;
  for (let k = 0; k < W; k += 1) {
    const weight = k + 1;
    totalWeight += weight;
    if (windowCandles[k]!.close > windowEma[k]!.value) weightedSum += weight;
  }
  const weightedPct = (weightedSum / totalWeight) * 100;
  const scoreA = cfg.weightedPctPoints * clamp01(weightedPct / 100);

  // B. Penetration depth on violation days (average).
  const startIndex = candles.length - W;
  const violations: { index: number; penetration: number }[] = [];
  for (let k = 0; k < W; k += 1) {
    const close = windowCandles[k]!.close;
    const ema = windowEma[k]!.value;
    if (close < ema) violations.push({ index: startIndex + k, penetration: ((ema - close) / ema) * 100 });
  }
  const avgPenetration = violations.length === 0 ? 0 : violations.reduce((t, v) => t + v.penetration, 0) / violations.length;
  const scoreB = cfg.penetrationPoints * clamp01(1 - avgPenetration / cfg.penetrationTargetPercent);

  // C. Recovery rate: did price close back above EMA20 within N sessions of a violation?
  // A violation is only "evaluable" if a full N-session window of future data exists within
  // this (already historically-bounded) candle array — never a truncated/partial window.
  const emaStartIndex = candles.length - ema20.values.length; // candles[j] <-> ema20.values[j - emaStartIndex]
  let evaluable = 0;
  let recovered = 0;
  for (const violation of violations) {
    const checkEnd = violation.index + cfg.recoveryWithinSessions;
    if (checkEnd > candles.length - 1) continue; // not enough future data within our historical slice to evaluate
    evaluable += 1;
    let didRecover = false;
    for (let j = violation.index + 1; j <= checkEnd; j += 1) {
      const emaAtJ = ema20.values[j - emaStartIndex]?.value;
      if (emaAtJ !== undefined && candles[j]!.close > emaAtJ) {
        didRecover = true;
        break;
      }
    }
    if (didRecover) recovered += 1;
  }
  const recoveryRate = evaluable === 0 ? 1 : recovered / evaluable;
  const scoreC = cfg.recoveryPoints * recoveryRate;

  // D. Current position relative to EMA20, graded.
  const currentClose = candles.at(-1)!.close;
  const currentEma = ema20.latest!.value;
  const scoreD =
    currentClose > currentEma
      ? cfg.currentPositionPoints
      : cfg.currentPositionPoints * clamp01(1 - ((currentEma - currentClose) / currentEma) * 100 / cfg.currentPositionTaperPercent);

  return available(weights.ema20Support, scoreA + scoreB + scoreC + scoreD);
}

// ---------------------------------------------------------------------------
// 5. 50 EMA Structural Support — 10 pts. Longer window, stricter floor, worst-case penetration.
// ---------------------------------------------------------------------------
export function calculateEma50SupportScore(candles: readonly Candle[], standardEmas: StandardEmaResults): ScoreComponent {
  const { weights, ema50Support: cfg } = RTT2_SCORE_CONFIG;
  const W = cfg.window;
  const ema50 = standardEmas.ema50;

  if (ema50.values.length < W || candles.length < W) return unavailable(weights.ema50Support, "INSUFFICIENT_DATA");

  const windowCandles = candles.slice(-W);
  const windowEma = ema50.values.slice(-W);
  if (windowEma.some((p) => !isFiniteNumber(p.value)) || windowCandles.some((c) => !isFiniteNumber(c.close))) {
    return unavailable(weights.ema50Support, "INVALID_DATA");
  }

  let aboveCount = 0;
  let maxPenetration = 0;
  for (let k = 0; k < W; k += 1) {
    const close = windowCandles[k]!.close;
    const ema = windowEma[k]!.value;
    if (close > ema) aboveCount += 1;
    else maxPenetration = Math.max(maxPenetration, ((ema - close) / ema) * 100);
  }
  const pctAbove = (aboveCount / W) * 100;

  const scoreA = cfg.pctAbovePoints * clamp01((pctAbove - cfg.pctAboveFloorPercent) / (cfg.pctAboveCeilingPercent - cfg.pctAboveFloorPercent));
  const scoreB = cfg.penetrationPoints * clamp01(1 - maxPenetration / cfg.worstPenetrationTargetPercent);

  return available(weights.ema50Support, scoreA + scoreB);
}

// ---------------------------------------------------------------------------
// 6. Momentum — 10 pts. Same 20-day measure as RTT 1.0, rebanded.
// ---------------------------------------------------------------------------
export function calculateMomentumScore2(candles: readonly Candle[]): { component: ScoreComponent; momentum20d: number | null } {
  const { weights } = RTT2_SCORE_CONFIG;
  if (candles.length < 21) return { component: unavailable(weights.momentum, "INSUFFICIENT_DATA"), momentum20d: null };
  const current = candles.at(-1)!;
  const prior = candles.at(-21)!;
  if (!isFiniteNumber(current.close) || !isFiniteNumber(prior.close) || prior.close <= 0) {
    return { component: unavailable(weights.momentum, "INVALID_DATA"), momentum20d: null };
  }
  const momentum20d = roundPercent(((current.close / prior.close) - 1) * 100);
  return { component: available(weights.momentum, bandScore(momentum20d, RTT2_SCORE_CONFIG.momentum20d)), momentum20d };
}

// ---------------------------------------------------------------------------
// 7. Breakout / Base Quality — 10 pts. Mechanical, no pattern recognition.
// ---------------------------------------------------------------------------
export function calculateBreakoutBaseQualityScore(candles: readonly Candle[]): ScoreComponent {
  const { weights, breakoutBaseQuality: cfg } = RTT2_SCORE_CONFIG;
  const totalNeeded = cfg.baseWindow + cfg.breakoutWindow;
  if (candles.length < totalNeeded) return unavailable(weights.breakoutBaseQuality, "INSUFFICIENT_DATA");

  const n = candles.length;
  const baseWindow = candles.slice(n - totalNeeded, n - cfg.breakoutWindow);
  const breakoutWindow = candles.slice(n - cfg.breakoutWindow, n);

  if ([...baseWindow, ...breakoutWindow].some((c) => !isFiniteNumber(c.high) || !isFiniteNumber(c.low) || !isFiniteNumber(c.close) || !isFiniteNumber(c.volume))) {
    return unavailable(weights.breakoutBaseQuality, "INVALID_DATA");
  }

  const baseHigh = Math.max(...baseWindow.map((c) => c.high));
  const baseLow = Math.min(...baseWindow.map((c) => c.low));
  const baseAvgClose = baseWindow.reduce((t, c) => t + c.close, 0) / baseWindow.length;
  const baseAvgVolume = baseWindow.reduce((t, c) => t + c.volume, 0) / baseWindow.length;
  const baseRangePct = ((baseHigh - baseLow) / baseAvgClose) * 100;
  const scoreTightness = cfg.tightnessPoints * clamp01(1 - baseRangePct / cfg.tightnessTargetPercent);

  const breakoutHigh = baseHigh;
  const firstBreakoutIndex = breakoutWindow.findIndex((c) => c.close > breakoutHigh);
  const breakoutOccurred = firstBreakoutIndex !== -1;
  const scoreBreakout = breakoutOccurred ? cfg.breakoutPoints : 0;

  let scoreFreshness = 0;
  let scoreDistance = 0;
  let scoreConfirmation = 0;
  let scoreVolume = 0;

  if (breakoutOccurred) {
    const daysSinceBreakout = breakoutWindow.length - 1 - firstBreakoutIndex;
    scoreFreshness = cfg.freshnessPoints * clamp01(1 - daysSinceBreakout / cfg.freshnessMaxSessions);

    const currentClose = candles.at(-1)!.close;
    const extensionSinceBreakout = ((currentClose / breakoutHigh) - 1) * 100;
    scoreDistance = cfg.distancePoints * clamp01(1 - extensionSinceBreakout / cfg.distanceTargetPercent);

    scoreConfirmation = currentClose > breakoutHigh ? cfg.confirmationPoints : 0;

    const breakoutVolume = breakoutWindow[firstBreakoutIndex]!.volume;
    scoreVolume = breakoutVolume >= cfg.volumeMultiplier * baseAvgVolume ? cfg.volumePoints : 0;
  }

  return available(
    weights.breakoutBaseQuality,
    scoreTightness + scoreBreakout + scoreFreshness + scoreDistance + scoreConfirmation + scoreVolume,
  );
}

// ---------------------------------------------------------------------------
// 8. Volume Confirmation — 5 pts. Same RVOL measure as RTT 1.0, rebanded.
// ---------------------------------------------------------------------------
export function calculateVolumeScore2(candles: readonly Candle[]): { component: ScoreComponent; rvol: number | null } {
  const { weights } = RTT2_SCORE_CONFIG;
  if (candles.length < 21) return { component: unavailable(weights.volume, "INSUFFICIENT_DATA"), rvol: null };
  const current = candles.at(-1)!;
  const history = candles.slice(-21, -1);
  if (!isFiniteNumber(current.volume) || current.volume < 0 || !history.every((c) => isFiniteNumber(c.volume) && c.volume >= 0)) {
    return { component: unavailable(weights.volume, "INVALID_DATA"), rvol: null };
  }
  const averageVolume = history.reduce((t, c) => t + c.volume, 0) / history.length;
  if (averageVolume <= 0) return { component: unavailable(weights.volume, "INVALID_DATA"), rvol: null };
  const rvol = current.volume / averageVolume;
  return { component: available(weights.volume, bandScore(rvol, RTT2_SCORE_CONFIG.relativeVolume)), rvol };
}

// ---------------------------------------------------------------------------
// 9. RSI Health — 3 pts. Broad plateau. NEVER a qualification gate.
// ---------------------------------------------------------------------------
export function calculateRsiHealthScore(rsi14: number | null | undefined): ScoreComponent {
  const { weights, rsiHealth: cfg } = RTT2_SCORE_CONFIG;
  if (rsi14 === null || rsi14 === undefined) return unavailable(weights.rsiHealth, "INSUFFICIENT_DATA");
  if (!isFiniteNumber(rsi14)) return unavailable(weights.rsiHealth, "INVALID_DATA");

  let score: number;
  if (rsi14 >= cfg.healthyMin && rsi14 <= cfg.healthyMax) {
    score = weights.rsiHealth;
  } else if (rsi14 >= cfg.weakFloor && rsi14 < cfg.healthyMin) {
    score = weights.rsiHealth * ((rsi14 - cfg.weakFloor) / (cfg.healthyMin - cfg.weakFloor));
  } else if (rsi14 > cfg.healthyMax && rsi14 <= cfg.overheatedCeiling) {
    score = weights.rsiHealth * ((cfg.overheatedCeiling - rsi14) / (cfg.overheatedCeiling - cfg.healthyMax));
  } else {
    score = 0;
  }
  return available(weights.rsiHealth, score);
}

// ---------------------------------------------------------------------------
// 10. Extension / Entry Quality — 2 pts. Symmetric around EMA20 (bug-fixed).
// ---------------------------------------------------------------------------
export function calculateExtensionScore2(candles: readonly Candle[], emaValues: EmaValues): { component: ScoreComponent; extensionPct: number | null } {
  const { weights, extension: cfg } = RTT2_SCORE_CONFIG;
  const ema20 = emaValues.ema20;
  if (ema20 === null) return { component: unavailable(weights.extension, "INSUFFICIENT_DATA"), extensionPct: null };
  const price = candles.at(-1)?.close;
  if (!isFiniteNumber(price) || !isFiniteNumber(ema20) || ema20 <= 0) {
    return { component: unavailable(weights.extension, "INVALID_DATA"), extensionPct: null };
  }
  const extensionPct = roundPercent(((price / ema20) - 1) * 100);
  const score = weights.extension * clamp01(1 - Math.abs(extensionPct) / cfg.taperPercent);
  return { component: available(weights.extension, score), extensionPct };
}

// ---------------------------------------------------------------------------
// Top-level orchestration.
// ---------------------------------------------------------------------------
function emptyResult(
  symbol: string,
  rejectionReason: Rtt2RejectionReason,
  sectorContext: SectorStrength | null,
  rsi: number | null = null,
): Rtt2ScoreResult {
  const reason = rejectionReason === "INVALID_DATA" ? "INVALID_DATA" : "INSUFFICIENT_DATA";
  const { weights } = RTT2_SCORE_CONFIG;
  return {
    symbol,
    qualified: false,
    rejectionReason,
    rttScore: null,
    classification: null,
    emaStructureScore: unavailable(weights.emaStructure, reason),
    emaSlopeExpansionScore: unavailable(weights.emaSlopeExpansion, reason),
    earlyTrendDevelopmentScore: unavailable(weights.earlyTrendDevelopment, reason),
    ema20SupportScore: unavailable(weights.ema20Support, reason),
    ema50SupportScore: unavailable(weights.ema50Support, reason),
    momentumScore: unavailable(weights.momentum, reason),
    breakoutBaseQualityScore: unavailable(weights.breakoutBaseQuality, reason),
    volumeScore: unavailable(weights.volume, reason),
    rsiHealthScore: unavailable(weights.rsiHealth, reason),
    extensionScore: unavailable(weights.extension, reason),
    rsi,
    momentum20d: null,
    rvol: null,
    extensionPct: null,
    sectorContext,
  };
}

export function calculateRtt2Score(input: Rtt2ScoreInput): Rtt2ScoreResult {
  const sectorContext = input.sectorStrength ?? null;
  if (!input.symbol || !Array.isArray(input.candles)) return emptyResult(input.symbol, "INVALID_DATA", sectorContext);

  let standardEmas: StandardEmaResults;
  let rsi14: number | null;
  try {
    standardEmas = calculateStandardEmas(input.candles);
    rsi14 = getLatestRsiValue(calculateRsi(input.candles));
  } catch {
    return emptyResult(input.symbol, "INVALID_DATA", sectorContext);
  }

  const emaValues = getLatestEmaValues(standardEmas);
  const qualification = evaluateRtt2Qualification(emaValues);
  if (!qualification.qualified) return emptyResult(input.symbol, qualification.rejectionReason, sectorContext, rsi14);

  const emaStructureScore = calculateEmaStructureScore(emaValues);
  const emaSlopeExpansionScore = calculateEmaSlopeExpansionScore(standardEmas);
  const earlyTrendDevelopmentScore = calculateEarlyTrendDevelopmentScore(input.candles, standardEmas);
  const ema20SupportScore = calculateEma20SupportScore(input.candles, standardEmas);
  const ema50SupportScore = calculateEma50SupportScore(input.candles, standardEmas);
  const momentum = calculateMomentumScore2(input.candles);
  const breakoutBaseQualityScore = calculateBreakoutBaseQualityScore(input.candles);
  const volume = calculateVolumeScore2(input.candles);
  const rsiHealthScore = calculateRsiHealthScore(rsi14);
  const extension = calculateExtensionScore2(input.candles, emaValues);

  const components = [
    emaStructureScore,
    emaSlopeExpansionScore,
    earlyTrendDevelopmentScore,
    ema20SupportScore,
    ema50SupportScore,
    momentum.component,
    breakoutBaseQualityScore,
    volume.component,
    rsiHealthScore,
    extension.component,
  ];
  const rttScore = components.every((c) => c.score !== null)
    ? roundScore(components.reduce((total, c) => total + c.score!, 0))
    : null;

  return {
    symbol: input.symbol,
    qualified: true,
    rejectionReason: null,
    rttScore,
    classification: rttScore === null ? null : classifyRttScore(rttScore),
    emaStructureScore,
    emaSlopeExpansionScore,
    earlyTrendDevelopmentScore,
    ema20SupportScore,
    ema50SupportScore,
    momentumScore: momentum.component,
    breakoutBaseQualityScore,
    volumeScore: volume.component,
    rsiHealthScore,
    extensionScore: extension.component,
    rsi: rsi14,
    momentum20d: momentum.momentum20d,
    rvol: volume.rvol,
    extensionPct: extension.extensionPct,
    sectorContext,
  };
}
