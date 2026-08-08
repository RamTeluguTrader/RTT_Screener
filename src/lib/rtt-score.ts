import { RTT_SCORE_CONFIG } from "./rtt-config";
import {
  calculateStandardEmas,
  getLatestEmaValues,
  isEmaAligned,
  type Candle,
  type EmaValues,
} from "./technical-analysis";

export type RttRejectionReason =
  | "EMA_ALIGNMENT_FAILED"
  | "RSI_OUT_OF_RANGE"
  | "INSUFFICIENT_DATA"
  | "INVALID_DATA";

export type ScoreAvailabilityReason = "INSUFFICIENT_DATA" | "INVALID_DATA";

export type ScoreComponent = {
  score: number | null;
  maximum: number;
  unavailableReason: ScoreAvailabilityReason | null;
};

export type SectorStrength = {
  sector: string;
  performance20d: number;
  rank: number;
  totalSectors: number;
};

export type SectorMembers = {
  sector: string;
  members: readonly { symbol: string; candles: readonly Candle[] }[];
};

export type RttScoreInput = {
  symbol: string;
  candles: readonly Candle[];
  rsi14?: number;
  high52Week?: number;
  sectorStrength?: SectorStrength;
};

export type RttClassification = "Exceptional" | "Strong" | "Good" | "Watch" | "Weak";

export type RttScoreResult = {
  symbol: string;
  qualified: boolean;
  rejectionReason: RttRejectionReason | null;
  rttScore: number | null;
  classification: RttClassification | null;
  emaStackScore: ScoreComponent;
  priceVsEmaScore: ScoreComponent;
  momentumScore: ScoreComponent;
  volumeScore: ScoreComponent;
  sectorScore: ScoreComponent;
  highProximityScore: ScoreComponent;
  extensionScore: ScoreComponent;
  rsi: number | null;
  momentum20d: number | null;
  rvol: number | null;
  sectorPerformance: number | null;
  distanceFrom52WeekHigh: number | null;
  extensionFromEma20: number | null;
};

type QualificationResult = { qualified: true; rejectionReason: null } | {
  qualified: false;
  rejectionReason: RttRejectionReason;
};

const EMPTY_COMPONENTS = {
  emaStackScore: { maximum: RTT_SCORE_CONFIG.weights.emaStack },
  priceVsEmaScore: { maximum: RTT_SCORE_CONFIG.weights.priceVsEma },
  momentumScore: { maximum: RTT_SCORE_CONFIG.weights.momentum },
  volumeScore: { maximum: RTT_SCORE_CONFIG.weights.volume },
  sectorScore: { maximum: RTT_SCORE_CONFIG.weights.sector },
  highProximityScore: { maximum: RTT_SCORE_CONFIG.weights.highProximity },
  extensionScore: { maximum: RTT_SCORE_CONFIG.weights.extension },
} as const;

function unavailable(maximum: number, unavailableReason: ScoreAvailabilityReason): ScoreComponent {
  return { score: null, maximum, unavailableReason };
}

function available(maximum: number, score: number): ScoreComponent {
  return { score, maximum, unavailableReason: null };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizePercentage(value: number): number {
  return Math.round(value * 100_000_000) / 100_000_000;
}

function emptyResult(symbol: string, rejectionReason: RttRejectionReason, rsi: number | null): RttScoreResult {
  return {
    symbol,
    qualified: false,
    rejectionReason,
    rttScore: null,
    classification: null,
    emaStackScore: unavailable(EMPTY_COMPONENTS.emaStackScore.maximum, rejectionReason === "INVALID_DATA" ? "INVALID_DATA" : "INSUFFICIENT_DATA"),
    priceVsEmaScore: unavailable(EMPTY_COMPONENTS.priceVsEmaScore.maximum, rejectionReason === "INVALID_DATA" ? "INVALID_DATA" : "INSUFFICIENT_DATA"),
    momentumScore: unavailable(EMPTY_COMPONENTS.momentumScore.maximum, rejectionReason === "INVALID_DATA" ? "INVALID_DATA" : "INSUFFICIENT_DATA"),
    volumeScore: unavailable(EMPTY_COMPONENTS.volumeScore.maximum, rejectionReason === "INVALID_DATA" ? "INVALID_DATA" : "INSUFFICIENT_DATA"),
    sectorScore: unavailable(EMPTY_COMPONENTS.sectorScore.maximum, rejectionReason === "INVALID_DATA" ? "INVALID_DATA" : "INSUFFICIENT_DATA"),
    highProximityScore: unavailable(EMPTY_COMPONENTS.highProximityScore.maximum, rejectionReason === "INVALID_DATA" ? "INVALID_DATA" : "INSUFFICIENT_DATA"),
    extensionScore: unavailable(EMPTY_COMPONENTS.extensionScore.maximum, rejectionReason === "INVALID_DATA" ? "INVALID_DATA" : "INSUFFICIENT_DATA"),
    rsi,
    momentum20d: null,
    rvol: null,
    sectorPerformance: null,
    distanceFrom52WeekHigh: null,
    extensionFromEma20: null,
  };
}

export function evaluateRttQualification(emaValues: EmaValues, rsi14?: number): QualificationResult {
  const values = [emaValues.ema10, emaValues.ema20, emaValues.ema50, emaValues.ema100, emaValues.ema200];
  if (rsi14 === undefined || values.some((value) => value === null)) {
    return { qualified: false, rejectionReason: "INSUFFICIENT_DATA" };
  }
  if (!isFiniteNumber(rsi14) || !values.every(isFiniteNumber)) {
    return { qualified: false, rejectionReason: "INVALID_DATA" };
  }
  if (!isEmaAligned(emaValues)) {
    return { qualified: false, rejectionReason: "EMA_ALIGNMENT_FAILED" };
  }
  if (rsi14 < RTT_SCORE_CONFIG.rsi.minimum || rsi14 > RTT_SCORE_CONFIG.rsi.maximum) {
    return { qualified: false, rejectionReason: "RSI_OUT_OF_RANGE" };
  }
  return { qualified: true, rejectionReason: null };
}

export function calculateEmaStackScore(emaValues: EmaValues): ScoreComponent {
  const values = [emaValues.ema10, emaValues.ema20, emaValues.ema50, emaValues.ema100, emaValues.ema200];
  if (values.some((value) => value === null)) return unavailable(RTT_SCORE_CONFIG.weights.emaStack, "INSUFFICIENT_DATA");
  if (!values.every(isFiniteNumber)) return unavailable(RTT_SCORE_CONFIG.weights.emaStack, "INVALID_DATA");

  const separations = values.slice(0, -1).map((value, index) => ((value / values[index + 1]! - 1) * 100));
  const averageSeparation = separations.reduce((total, value) => total + value, 0) / separations.length;
  const score = Math.max(0, Math.min(1, averageSeparation / RTT_SCORE_CONFIG.emaStackQuality.targetAverageSeparationPercent)) * RTT_SCORE_CONFIG.weights.emaStack;
  return available(RTT_SCORE_CONFIG.weights.emaStack, roundScore(score));
}

export function calculatePriceVsEmaScore(price: number, emaValues: EmaValues): ScoreComponent {
  const values = [emaValues.ema10, emaValues.ema20, emaValues.ema50, emaValues.ema100, emaValues.ema200];
  if (values.some((value) => value === null)) return unavailable(RTT_SCORE_CONFIG.weights.priceVsEma, "INSUFFICIENT_DATA");
  if (!isFiniteNumber(price) || !values.every(isFiniteNumber)) return unavailable(RTT_SCORE_CONFIG.weights.priceVsEma, "INVALID_DATA");
  const [ema10, ema20, ema50, ema100, ema200] = values;
  const points = RTT_SCORE_CONFIG.priceVsEma;
  const score = (price > ema10 ? points.ema10 : 0) + (price > ema20 ? points.ema20 : 0) + (price > ema50 ? points.ema50 : 0) + (price > ema100 ? points.ema100 : 0) + (price > ema200 ? points.ema200 : 0);
  return available(RTT_SCORE_CONFIG.weights.priceVsEma, score);
}

function scoreMinimum(value: number, bands: readonly { minimumPercent?: number; minimum?: number; score: number }[]): number {
  return bands.find((band) => value >= (band.minimumPercent ?? band.minimum ?? Number.POSITIVE_INFINITY))!.score;
}

export function calculateMomentumScore(candles: readonly Candle[]): { component: ScoreComponent; momentum20d: number | null } {
  if (candles.length < 21) return { component: unavailable(RTT_SCORE_CONFIG.weights.momentum, "INSUFFICIENT_DATA"), momentum20d: null };
  const current = candles.at(-1)!;
  const prior = candles.at(-21)!;
  if (!isFiniteNumber(current.close) || !isFiniteNumber(prior.close) || prior.close <= 0) return { component: unavailable(RTT_SCORE_CONFIG.weights.momentum, "INVALID_DATA"), momentum20d: null };
  const momentum20d = normalizePercentage(((current.close / prior.close) - 1) * 100);
  return { component: available(RTT_SCORE_CONFIG.weights.momentum, scoreMinimum(momentum20d, RTT_SCORE_CONFIG.momentum20d)), momentum20d };
}

export function calculateVolumeScore(candles: readonly Candle[]): { component: ScoreComponent; rvol: number | null } {
  if (candles.length < 21) return { component: unavailable(RTT_SCORE_CONFIG.weights.volume, "INSUFFICIENT_DATA"), rvol: null };
  const current = candles.at(-1)!;
  const history = candles.slice(-21, -1);
  if (!isFiniteNumber(current.volume) || current.volume < 0 || !history.every((candle) => isFiniteNumber(candle.volume) && candle.volume >= 0)) return { component: unavailable(RTT_SCORE_CONFIG.weights.volume, "INVALID_DATA"), rvol: null };
  const averageVolume = history.reduce((total, candle) => total + candle.volume, 0) / history.length;
  if (averageVolume <= 0) return { component: unavailable(RTT_SCORE_CONFIG.weights.volume, "INVALID_DATA"), rvol: null };
  const rvol = current.volume / averageVolume;
  return { component: available(RTT_SCORE_CONFIG.weights.volume, scoreMinimum(rvol, RTT_SCORE_CONFIG.relativeVolume)), rvol };
}

export function calculateHighProximityScore(price: number, high52Week?: number): { component: ScoreComponent; distanceFrom52WeekHigh: number | null } {
  if (high52Week === undefined) return { component: unavailable(RTT_SCORE_CONFIG.weights.highProximity, "INSUFFICIENT_DATA"), distanceFrom52WeekHigh: null };
  if (!isFiniteNumber(price) || !isFiniteNumber(high52Week) || price <= 0 || high52Week <= 0 || high52Week < price) return { component: unavailable(RTT_SCORE_CONFIG.weights.highProximity, "INVALID_DATA"), distanceFrom52WeekHigh: null };
  const distanceFrom52WeekHigh = normalizePercentage(((high52Week - price) / high52Week) * 100);
  const score = RTT_SCORE_CONFIG.highProximity.find((band) => distanceFrom52WeekHigh <= band.maximumDistancePercent)!.score;
  return { component: available(RTT_SCORE_CONFIG.weights.highProximity, score), distanceFrom52WeekHigh };
}

export function calculateExtensionScore(price: number, ema20: number | null): { component: ScoreComponent; extensionFromEma20: number | null } {
  if (ema20 === null) return { component: unavailable(RTT_SCORE_CONFIG.weights.extension, "INSUFFICIENT_DATA"), extensionFromEma20: null };
  if (!isFiniteNumber(price) || !isFiniteNumber(ema20) || ema20 <= 0) return { component: unavailable(RTT_SCORE_CONFIG.weights.extension, "INVALID_DATA"), extensionFromEma20: null };
  const extensionFromEma20 = normalizePercentage(((price / ema20) - 1) * 100);
  const score = RTT_SCORE_CONFIG.extension.find((band) => extensionFromEma20 <= band.maximumPercent)!.score;
  return { component: available(RTT_SCORE_CONFIG.weights.extension, score), extensionFromEma20 };
}

export function calculateSectorScore(sectorStrength?: SectorStrength): ScoreComponent {
  if (!sectorStrength) return unavailable(RTT_SCORE_CONFIG.weights.sector, "INSUFFICIENT_DATA");
  if (!isFiniteNumber(sectorStrength.performance20d) || !Number.isInteger(sectorStrength.rank) || !Number.isInteger(sectorStrength.totalSectors) || sectorStrength.rank < 1 || sectorStrength.rank > sectorStrength.totalSectors || sectorStrength.totalSectors < 1) return unavailable(RTT_SCORE_CONFIG.weights.sector, "INVALID_DATA");
  const percentile = sectorStrength.totalSectors === 1 ? 0 : (sectorStrength.rank - 1) / (sectorStrength.totalSectors - 1);
  const scores = RTT_SCORE_CONFIG.sectorRank;
  const score = percentile <= 0.1 ? scores.topTenPercent : percentile <= 0.25 ? scores.topQuarter : percentile <= 0.5 ? scores.topHalf : percentile >= 0.9 ? scores.bottomTenPercent : percentile >= 0.75 ? scores.bottomQuarter : scores.bottomHalf;
  return available(RTT_SCORE_CONFIG.weights.sector, score);
}

export function calculateSectorStrengths(sectors: readonly SectorMembers[]): SectorStrength[] {
  const performance = sectors.flatMap((sector) => {
    const memberReturns = sector.members.flatMap((member) => {
      const result = calculateMomentumScore(member.candles);
      return result.momentum20d === null ? [] : [result.momentum20d];
    });
    if (!sector.sector || memberReturns.length === 0) return [];
    return [{ sector: sector.sector, performance20d: memberReturns.reduce((total, value) => total + value, 0) / memberReturns.length }];
  }).sort((left, right) => right.performance20d - left.performance20d || left.sector.localeCompare(right.sector));

  return performance.map((item, index) => ({ ...item, rank: index + 1, totalSectors: performance.length }));
}

export function classifyRttScore(score: number): RttClassification {
  if (score >= 90) return "Exceptional";
  if (score >= 80) return "Strong";
  if (score >= 70) return "Good";
  if (score >= 60) return "Watch";
  return "Weak";
}

export function calculateRttScore(input: RttScoreInput): RttScoreResult {
  const rsi = input.rsi14 ?? null;
  if (!input.symbol || !Array.isArray(input.candles)) return emptyResult(input.symbol, "INVALID_DATA", rsi);

  let emaValues: EmaValues;
  try {
    emaValues = getLatestEmaValues(calculateStandardEmas(input.candles));
  } catch {
    return emptyResult(input.symbol, "INVALID_DATA", rsi);
  }

  const qualification = evaluateRttQualification(emaValues, input.rsi14);
  if (!qualification.qualified) return emptyResult(input.symbol, qualification.rejectionReason, rsi);

  const price = input.candles.at(-1)!.close;
  const emaStackScore = calculateEmaStackScore(emaValues);
  const priceVsEmaScore = calculatePriceVsEmaScore(price, emaValues);
  const momentum = calculateMomentumScore(input.candles);
  const volume = calculateVolumeScore(input.candles);
  const sectorScore = calculateSectorScore(input.sectorStrength);
  const highProximity = calculateHighProximityScore(price, input.high52Week);
  const extension = calculateExtensionScore(price, emaValues.ema20);
  const components = [emaStackScore, priceVsEmaScore, momentum.component, volume.component, sectorScore, highProximity.component, extension.component];
  const rttScore = components.every((component) => component.score !== null) ? roundScore(components.reduce((total, component) => total + component.score!, 0)) : null;

  return {
    symbol: input.symbol,
    qualified: true,
    rejectionReason: null,
    rttScore,
    classification: rttScore === null ? null : classifyRttScore(rttScore),
    emaStackScore,
    priceVsEmaScore,
    momentumScore: momentum.component,
    volumeScore: volume.component,
    sectorScore,
    highProximityScore: highProximity.component,
    extensionScore: extension.component,
    rsi,
    momentum20d: momentum.momentum20d,
    rvol: volume.rvol,
    sectorPerformance: input.sectorStrength?.performance20d ?? null,
    distanceFrom52WeekHigh: highProximity.distanceFrom52WeekHigh,
    extensionFromEma20: extension.extensionFromEma20,
  };
}
