import { RTT2X_SCORE_CONFIG } from "./rtt2x-config";
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
 * RTT 2.X scoring engine — the final research-iteration model. A parallel,
 * independent model to RTT 1.0 (rtt-score.ts) and RTT 2.0 (rtt2-score.ts),
 * neither of which is modified by this file.
 *
 * Qualification: EMA alignment (10>20>50>100>200) is the ONLY hard gate,
 * unchanged from RTT 2.0. RSI is never a gate — it contributes only to the
 * RSI Health score. Sector Strength is a separate contextual field on the
 * result and never contributes to the 100-point rttScore.
 *
 * Conceptually simplified from RTT 2.0's 10 components to 9: Breakout/Base
 * Quality was removed outright (it was an inverted signal in the RTT 2.0
 * historical study), and Early Trend Development was redesigned as
 * age-neutral "Current Trend Development" (present-tense trend quality,
 * not acceleration-vs-prior-window or days-since-alignment).
 */

export type Rtt2xRejectionReason = "EMA_ALIGNMENT_FAILED" | "INSUFFICIENT_DATA" | "INVALID_DATA";

export type Rtt2xQualificationResult =
  | { qualified: true; rejectionReason: null }
  | { qualified: false; rejectionReason: Rtt2xRejectionReason };

export type Rtt2xScoreInput = {
  symbol: string;
  candles: readonly Candle[];
  /** Contextual only — never added into rttScore. */
  sectorStrength?: SectorStrength;
};

export type Rtt2xScoreResult = {
  symbol: string;
  qualified: boolean;
  rejectionReason: Rtt2xRejectionReason | null;
  rttScore: number | null;
  classification: RttClassification | null;
  emaStructureScore: ScoreComponent;
  emaSlopeExpansionScore: ScoreComponent;
  ema20ResilienceScore: ScoreComponent;
  ema50ResilienceScore: ScoreComponent;
  trendDevelopmentScore: ScoreComponent;
  momentumScore: ScoreComponent;
  extensionScore: ScoreComponent;
  volumeScore: ScoreComponent;
  rsiHealthScore: ScoreComponent;
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

export function evaluateRtt2xQualification(emaValues: EmaValues): Rtt2xQualificationResult {
  const values = [emaValues.ema10, emaValues.ema20, emaValues.ema50, emaValues.ema100, emaValues.ema200];
  if (values.some((value) => value === null)) return { qualified: false, rejectionReason: "INSUFFICIENT_DATA" };
  if (!values.every(isFiniteNumber)) return { qualified: false, rejectionReason: "INVALID_DATA" };
  if (!isEmaAligned(emaValues)) return { qualified: false, rejectionReason: "EMA_ALIGNMENT_FAILED" };
  return { qualified: true, rejectionReason: null };
}

// ---------------------------------------------------------------------------
// A. EMA Structure Quality — 14 pts. Same algorithm as RTT 2.0's emaStructure.
// ---------------------------------------------------------------------------
export function calculateEmaStructureScore(emaValues: EmaValues): ScoreComponent {
  const { weights, emaStructure } = RTT2X_SCORE_CONFIG;
  const values = [emaValues.ema10, emaValues.ema20, emaValues.ema50, emaValues.ema100, emaValues.ema200];
  if (values.some((value) => value === null)) return unavailable(weights.emaStructure, "INSUFFICIENT_DATA");
  if (!values.every(isFiniteNumber)) return unavailable(weights.emaStructure, "INVALID_DATA");

  const seps = values.slice(0, -1).map((value, index) => (value / values[index + 1]! - 1) * 100);
  const avgSep = seps.reduce((total, value) => total + value, 0) / seps.length;
  const score = clamp01(avgSep / emaStructure.targetAverageSeparationPercent) * weights.emaStructure;
  return available(weights.emaStructure, score);
}

// ---------------------------------------------------------------------------
// B. EMA Slope & Expansion — 14 pts (7 slope + 7 expansion). EMA20/50/100/200.
// Same algorithm and targets as RTT 2.0, reweighted.
// ---------------------------------------------------------------------------
const SLOPE_EXPANSION_EMAS = ["ema20", "ema50", "ema100", "ema200"] as const;
const SLOPE_EXPANSION_PAIRS = [
  ["ema20", "ema50"],
  ["ema50", "ema100"],
  ["ema100", "ema200"],
] as const;

export function calculateEmaSlopeExpansionScore(standardEmas: StandardEmaResults): ScoreComponent {
  const { weights, slopeExpansion } = RTT2X_SCORE_CONFIG;
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
// C. 20 EMA Trend Resilience — 22 pts. The largest component. Continuous,
// recency-weighted, tolerant of occasional shallow dips; only frequent or
// deep violations are penalized. No hard floor, no zero-violation requirement.
// ---------------------------------------------------------------------------
export function calculateEma20ResilienceScore(candles: readonly Candle[], standardEmas: StandardEmaResults): ScoreComponent {
  const { weights, ema20Resilience: cfg } = RTT2X_SCORE_CONFIG;
  const W = cfg.window;
  const ema20 = standardEmas.ema20;

  if (ema20.values.length < W || candles.length < W) return unavailable(weights.ema20Resilience, "INSUFFICIENT_DATA");

  const windowCandles = candles.slice(-W);
  const windowEma = ema20.values.slice(-W);
  if (windowEma.some((p) => !isFiniteNumber(p.value)) || windowCandles.some((c) => !isFiniteNumber(c.close))) {
    return unavailable(weights.ema20Resilience, "INVALID_DATA");
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

  // B. Penetration depth on violation days (average — shallow dips are fine, deep ones are not).
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
  const emaStartIndex = candles.length - ema20.values.length;
  let evaluable = 0;
  let recovered = 0;
  for (const violation of violations) {
    const checkEnd = violation.index + cfg.recoveryWithinSessions;
    if (checkEnd > candles.length - 1) continue;
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

  // D. Current position relative to EMA20, graded (above = full marks, tapered below).
  const currentClose = candles.at(-1)!.close;
  const currentEma = ema20.latest!.value;
  const scoreD =
    currentClose > currentEma
      ? cfg.currentPositionPoints
      : cfg.currentPositionPoints * clamp01(1 - ((currentEma - currentClose) / currentEma) * 100 / cfg.currentPositionTaperPercent);

  // E. Violation-count control: a few shallow dips are fine, frequent whipsaws are not.
  // No bonus for zero violations beyond the "full marks" band — occasional dips are expected.
  const violationCount = violations.length;
  const { violationCountFullMarksMax: fullMarksMax, violationCountZeroMax: zeroMax } = cfg;
  const scoreE = cfg.violationCountPoints * clamp01(1 - Math.max(0, violationCount - fullMarksMax) / (zeroMax - fullMarksMax));

  return available(weights.ema20Resilience, scoreA + scoreB + scoreC + scoreD + scoreE);
}

// ---------------------------------------------------------------------------
// D. 50 EMA Structural Resilience — 14 pts. Longer window, worst-case
// penetration, plus a dedicated check that EMA50 itself is rising.
// ---------------------------------------------------------------------------
export function calculateEma50ResilienceScore(candles: readonly Candle[], standardEmas: StandardEmaResults): ScoreComponent {
  const { weights, ema50Resilience: cfg } = RTT2X_SCORE_CONFIG;
  const W = cfg.window;
  const ema50 = standardEmas.ema50;

  if (ema50.values.length < Math.max(W, cfg.slopeLookback + 1) || candles.length < W) {
    return unavailable(weights.ema50Resilience, "INSUFFICIENT_DATA");
  }

  const windowCandles = candles.slice(-W);
  const windowEma = ema50.values.slice(-W);
  const slopeNow = valueAtOffset(ema50, 0);
  const slopePast = valueAtOffset(ema50, cfg.slopeLookback);
  if (
    windowEma.some((p) => !isFiniteNumber(p.value)) ||
    windowCandles.some((c) => !isFiniteNumber(c.close)) ||
    slopeNow === null ||
    slopePast === null
  ) {
    return unavailable(weights.ema50Resilience, "INVALID_DATA");
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

  const scoreA = cfg.pctAbovePoints * clamp01(pctAbove / 100);
  const scoreB = cfg.penetrationPoints * clamp01(1 - maxPenetration / cfg.worstPenetrationTargetPercent);

  const slope = (slopeNow / slopePast - 1) * 100;
  const scoreC = cfg.slopePoints * clamp01(slope / cfg.slopeTargetPercent);

  return available(weights.ema50Resilience, scoreA + scoreB + scoreC);
}

// ---------------------------------------------------------------------------
// E. Current Trend Development — 10 pts. Age-neutral present-tense trend
// quality: current EMA20 slope health, recent higher-highs/higher-lows, and
// current (not accelerating) stack expansion. Does NOT reward "freshly
// aligned" over "long aligned", or vice versa.
// ---------------------------------------------------------------------------
export function calculateTrendDevelopmentScore(candles: readonly Candle[], standardEmas: StandardEmaResults): ScoreComponent {
  const { weights, trendDevelopment: cfg } = RTT2X_SCORE_CONFIG;
  const maxOffsetNeeded = Math.max(cfg.emaSlopeWindow, cfg.expansionWindow);

  if (
    candles.length < Math.max(cfg.hhhlWindow, maxOffsetNeeded + 1) ||
    standardEmas.ema20.values.length < maxOffsetNeeded + 1 ||
    standardEmas.ema50.values.length < maxOffsetNeeded + 1
  ) {
    return unavailable(weights.trendDevelopment, "INSUFFICIENT_DATA");
  }

  const ema20 = standardEmas.ema20;
  const ema50 = standardEmas.ema50;
  const ema20Now = valueAtOffset(ema20, 0);
  const ema20Slope = valueAtOffset(ema20, cfg.emaSlopeWindow);
  const ema20Exp = valueAtOffset(ema20, cfg.expansionWindow);
  const ema50Now = valueAtOffset(ema50, 0);
  const ema50Exp = valueAtOffset(ema50, cfg.expansionWindow);
  const required = [ema20Now, ema20Slope, ema20Exp, ema50Now, ema50Exp];
  if (required.some((v) => v === null)) return unavailable(weights.trendDevelopment, "INSUFFICIENT_DATA");
  if (!required.every(isFiniteNumber)) return unavailable(weights.trendDevelopment, "INVALID_DATA");

  // A. Current EMA20 slope health (recent pace, no comparison to a prior window).
  const slope = (ema20Now! / ema20Slope! - 1) * 100;
  const scoreA = cfg.emaSlopePoints * clamp01(slope / cfg.emaSlopeTargetPercent);

  // B. Higher-highs / higher-lows over the last N sessions (two halves), age-neutral.
  const hhhlWindow = candles.slice(-cfg.hhhlWindow);
  const half = cfg.hhhlWindow / 2;
  const olderHalf = hhhlWindow.slice(0, half);
  const recentHalf = hhhlWindow.slice(half);
  const higherHigh = Math.max(...recentHalf.map((c) => c.high)) > Math.max(...olderHalf.map((c) => c.high));
  const higherLow = Math.min(...recentHalf.map((c) => c.low)) > Math.min(...olderHalf.map((c) => c.low));
  const scoreB = (higherHigh ? cfg.hhhlPoints / 2 : 0) + (higherLow ? cfg.hhhlPoints / 2 : 0);

  // C. Is the stack currently still widening (EMA20/EMA50 separation now vs a short window ago)?
  const sepNow = (ema20Now! / ema50Now! - 1) * 100;
  const sepPast = (ema20Exp! / ema50Exp! - 1) * 100;
  const expansion = sepNow - sepPast;
  const scoreC = cfg.expansionPoints * clamp01(expansion / cfg.expansionTargetPercent);

  return available(weights.trendDevelopment, scoreA + scoreB + scoreC);
}

// ---------------------------------------------------------------------------
// F. Momentum — 8 pts. Same 20-day measure as RTT 2.0, rebanded — kept
// deliberately non-dominant.
// ---------------------------------------------------------------------------
export function calculateMomentumScore(candles: readonly Candle[]): { component: ScoreComponent; momentum20d: number | null } {
  const { weights } = RTT2X_SCORE_CONFIG;
  if (candles.length < 21) return { component: unavailable(weights.momentum, "INSUFFICIENT_DATA"), momentum20d: null };
  const current = candles.at(-1)!;
  const prior = candles.at(-21)!;
  if (!isFiniteNumber(current.close) || !isFiniteNumber(prior.close) || prior.close <= 0) {
    return { component: unavailable(weights.momentum, "INVALID_DATA"), momentum20d: null };
  }
  const momentum20d = roundPercent(((current.close / prior.close) - 1) * 100);
  return { component: available(weights.momentum, bandScore(momentum20d, RTT2X_SCORE_CONFIG.momentum20d)), momentum20d };
}

// ---------------------------------------------------------------------------
// G. Entry / Extension Quality — 8 pts. Symmetric around EMA20 (peak at 0%),
// widened taper band: avoid stocks already +15-20% above EMA20.
// ---------------------------------------------------------------------------
export function calculateExtensionScore(candles: readonly Candle[], emaValues: EmaValues): { component: ScoreComponent; extensionPct: number | null } {
  const { weights, extension: cfg } = RTT2X_SCORE_CONFIG;
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
// H. Volume Confirmation — 5 pts. Same RVOL measure as RTT 2.0, unchanged.
// ---------------------------------------------------------------------------
export function calculateVolumeScore(candles: readonly Candle[]): { component: ScoreComponent; rvol: number | null } {
  const { weights } = RTT2X_SCORE_CONFIG;
  if (candles.length < 21) return { component: unavailable(weights.volume, "INSUFFICIENT_DATA"), rvol: null };
  const current = candles.at(-1)!;
  const history = candles.slice(-21, -1);
  if (!isFiniteNumber(current.volume) || current.volume < 0 || !history.every((c) => isFiniteNumber(c.volume) && c.volume >= 0)) {
    return { component: unavailable(weights.volume, "INVALID_DATA"), rvol: null };
  }
  const averageVolume = history.reduce((t, c) => t + c.volume, 0) / history.length;
  if (averageVolume <= 0) return { component: unavailable(weights.volume, "INVALID_DATA"), rvol: null };
  const rvol = current.volume / averageVolume;
  return { component: available(weights.volume, bandScore(rvol, RTT2X_SCORE_CONFIG.relativeVolume)), rvol };
}

// ---------------------------------------------------------------------------
// I. RSI Health — 5 pts. Broad plateau. NEVER a qualification gate.
// ---------------------------------------------------------------------------
export function calculateRsiHealthScore(rsi14: number | null | undefined): ScoreComponent {
  const { weights, rsiHealth: cfg } = RTT2X_SCORE_CONFIG;
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
// Top-level orchestration.
// ---------------------------------------------------------------------------
function emptyResult(
  symbol: string,
  rejectionReason: Rtt2xRejectionReason,
  sectorContext: SectorStrength | null,
  rsi: number | null = null,
): Rtt2xScoreResult {
  const reason = rejectionReason === "INVALID_DATA" ? "INVALID_DATA" : "INSUFFICIENT_DATA";
  const { weights } = RTT2X_SCORE_CONFIG;
  return {
    symbol,
    qualified: false,
    rejectionReason,
    rttScore: null,
    classification: null,
    emaStructureScore: unavailable(weights.emaStructure, reason),
    emaSlopeExpansionScore: unavailable(weights.emaSlopeExpansion, reason),
    ema20ResilienceScore: unavailable(weights.ema20Resilience, reason),
    ema50ResilienceScore: unavailable(weights.ema50Resilience, reason),
    trendDevelopmentScore: unavailable(weights.trendDevelopment, reason),
    momentumScore: unavailable(weights.momentum, reason),
    extensionScore: unavailable(weights.extension, reason),
    volumeScore: unavailable(weights.volume, reason),
    rsiHealthScore: unavailable(weights.rsiHealth, reason),
    rsi,
    momentum20d: null,
    rvol: null,
    extensionPct: null,
    sectorContext,
  };
}

export function calculateRtt2xScore(input: Rtt2xScoreInput): Rtt2xScoreResult {
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
  const qualification = evaluateRtt2xQualification(emaValues);
  if (!qualification.qualified) return emptyResult(input.symbol, qualification.rejectionReason, sectorContext, rsi14);

  const emaStructureScore = calculateEmaStructureScore(emaValues);
  const emaSlopeExpansionScore = calculateEmaSlopeExpansionScore(standardEmas);
  const ema20ResilienceScore = calculateEma20ResilienceScore(input.candles, standardEmas);
  const ema50ResilienceScore = calculateEma50ResilienceScore(input.candles, standardEmas);
  const trendDevelopmentScore = calculateTrendDevelopmentScore(input.candles, standardEmas);
  const momentum = calculateMomentumScore(input.candles);
  const extension = calculateExtensionScore(input.candles, emaValues);
  const volume = calculateVolumeScore(input.candles);
  const rsiHealthScore = calculateRsiHealthScore(rsi14);

  const components = [
    emaStructureScore,
    emaSlopeExpansionScore,
    ema20ResilienceScore,
    ema50ResilienceScore,
    trendDevelopmentScore,
    momentum.component,
    extension.component,
    volume.component,
    rsiHealthScore,
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
    ema20ResilienceScore,
    ema50ResilienceScore,
    trendDevelopmentScore,
    momentumScore: momentum.component,
    extensionScore: extension.component,
    volumeScore: volume.component,
    rsiHealthScore,
    rsi: rsi14,
    momentum20d: momentum.momentum20d,
    rvol: volume.rvol,
    extensionPct: extension.extensionPct,
    sectorContext,
  };
}
