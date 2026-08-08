import { EMA_PERIODS } from "./technical-analysis";

export const RTT_SCORE_CONFIG = {
  emaPeriods: EMA_PERIODS,
  rsi: { minimum: 50, maximum: 75 },
  weights: {
    emaStack: 20,
    priceVsEma: 15,
    momentum: 20,
    volume: 15,
    sector: 15,
    highProximity: 5,
    extension: 10,
  },
  /**
   * The EMA stack score is linear from 0 to its maximum. An average 5% gap
   * across the four adjacent EMA pairs receives the full 20 points.
   */
  emaStackQuality: { targetAverageSeparationPercent: 5 },
  priceVsEma: { ema10: 5, ema20: 3, ema50: 3, ema100: 2, ema200: 2 },
  momentum20d: [
    { minimumPercent: 10, score: 20 },
    { minimumPercent: 7.5, score: 16 },
    { minimumPercent: 5, score: 12 },
    { minimumPercent: 2.5, score: 8 },
    { minimumPercent: 0, score: 4 },
    { minimumPercent: Number.NEGATIVE_INFINITY, score: 0 },
  ],
  relativeVolume: [
    { minimum: 2, score: 15 },
    { minimum: 1.5, score: 12 },
    { minimum: 1.25, score: 9 },
    { minimum: 1, score: 6 },
    { minimum: 0.75, score: 3 },
    { minimum: Number.NEGATIVE_INFINITY, score: 0 },
  ],
  highProximity: [
    { maximumDistancePercent: 2, score: 5 },
    { maximumDistancePercent: 5, score: 4 },
    { maximumDistancePercent: 10, score: 3 },
    { maximumDistancePercent: 15, score: 2 },
    { maximumDistancePercent: 25, score: 1 },
    { maximumDistancePercent: Number.POSITIVE_INFINITY, score: 0 },
  ],
  extension: [
    { maximumPercent: 3, score: 10 },
    { maximumPercent: 5, score: 8 },
    { maximumPercent: 8, score: 6 },
    { maximumPercent: 12, score: 3 },
    { maximumPercent: Number.POSITIVE_INFINITY, score: 0 },
  ],
  sectorRank: {
    topTenPercent: 15,
    topQuarter: 12,
    topHalf: 9,
    bottomHalf: 5,
    bottomQuarter: 2,
    bottomTenPercent: 0,
  },
} as const;
