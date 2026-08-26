/**
 * RTT 2.X scoring configuration — the final research iteration, designed once
 * (before any RTT 2.X historical testing) from the RTT 1.0 / RTT 2.0 A/B
 * comparison and RTT 2.0 component-attribution findings:
 *
 *  - EMA Structure was the strongest, most consistent positive signal in both
 *    studies -> kept, weight preserved rather than inflated.
 *  - Breakout/Base Quality was consistently INVERTED (higher scores linked to
 *    worse outcomes) -> removed entirely, not replaced with another breakout
 *    detector. Its weight is redistributed to the EMA20/EMA50 resilience and
 *    entry-quality concepts the user actually wants surfaced.
 *  - Early Trend Development showed weak differentiation and was structurally
 *    biased toward "freshly aligned" stocks -> redesigned as trend-resilience/
 *    current-trend-quality (age-neutral), at a reduced weight.
 *  - Momentum and RSI are kept deliberately secondary (RSI is context only,
 *    never a qualification gate).
 *
 * A parallel, independent model to RTT 1.0 (rtt-config.ts) and RTT 2.0
 * (rtt2-config.ts), neither of which is modified by this file. Weights sum
 * to exactly 100.
 *
 * Sector Strength is intentionally NOT part of this config/weights — it
 * remains a separate contextual metric only (see rtt2x-score.ts), unchanged
 * from RTT 2.0's treatment.
 */
export const RTT2X_SCORE_CONFIG = {
  weights: {
    emaStructure: 14,
    emaSlopeExpansion: 14,
    ema20Resilience: 22,
    ema50Resilience: 14,
    trendDevelopment: 10,
    momentum: 8,
    extension: 8,
    volume: 5,
    rsiHealth: 5,
  },

  /** A. EMA Structure Quality. Same algorithm as RTT 2.0's emaStructure, reweighted. */
  emaStructure: { targetAverageSeparationPercent: 5 },

  /** B. EMA Slope & Expansion. Same algorithm/targets as RTT 2.0, reweighted (7 + 7). */
  slopeExpansion: {
    lookback: 10,
    slopePointsMax: 7,
    slopeTargetPercent: 3,
    expansionPointsMax: 7,
    expansionTargetPercent: 1.5,
  },

  /**
   * C. 20 EMA Trend Resilience — the single largest component. Continuous,
   * recency-weighted, tolerant of occasional shallow dips; only frequent or
   * deep violations are penalized. No hard floor, no requirement of zero
   * violations.
   */
  ema20Resilience: {
    window: 30,
    weightedPctPoints: 8,
    penetrationPoints: 5,
    penetrationTargetPercent: 3,
    recoveryPoints: 4,
    recoveryWithinSessions: 3,
    currentPositionPoints: 3,
    currentPositionTaperPercent: 3,
    violationCountPoints: 2,
    violationCountFullMarksMax: 4,
    violationCountZeroMax: 12,
  },

  /**
   * D. 50 EMA Structural Resilience. Longer window, worst-case penetration,
   * plus a dedicated check that EMA50 itself is rising.
   */
  ema50Resilience: {
    window: 60,
    pctAbovePoints: 6,
    penetrationPoints: 4,
    worstPenetrationTargetPercent: 5,
    slopePoints: 4,
    slopeLookback: 10,
    slopeTargetPercent: 1.5,
  },

  /**
   * E. Current Trend Development — redesigned around present-tense trend
   * quality (is the trend healthy and still developing RIGHT NOW), not
   * acceleration-vs-prior-window or "days since alignment". Deliberately
   * age-neutral: a freshly aligned stock and a long-aligned stock are scored
   * identically as long as both show the same current behaviour.
   */
  trendDevelopment: {
    emaSlopePoints: 4,
    emaSlopeWindow: 5,
    emaSlopeTargetPercent: 1,
    hhhlPoints: 3,
    hhhlWindow: 10,
    expansionPoints: 3,
    expansionWindow: 5,
    expansionTargetPercent: 0.5,
  },

  /** F. Momentum. Same 20-day measure as RTT 2.0, rebanded to a smaller max — not the dominant factor. */
  momentum20d: [
    { minimumPercent: 10, score: 8 },
    { minimumPercent: 7.5, score: 6.5 },
    { minimumPercent: 5, score: 5 },
    { minimumPercent: 2.5, score: 3 },
    { minimumPercent: 0, score: 1.5 },
    { minimumPercent: Number.NEGATIVE_INFINITY, score: 0 },
  ],

  /**
   * G. Entry / Extension Quality. Symmetric around EMA20 (peak at 0%), same
   * shape as RTT 2.0's fix, but widened per the explicit target: avoid
   * stocks already +15-20% above EMA20, while not being overly punitive
   * inside that band.
   */
  extension: {
    taperPercent: 18,
  },

  /** H. Volume Confirmation. Same RVOL measure as RTT 2.0, unchanged weight. */
  relativeVolume: [
    { minimum: 2, score: 5 },
    { minimum: 1.5, score: 4 },
    { minimum: 1.25, score: 3 },
    { minimum: 1, score: 2 },
    { minimum: 0.75, score: 1 },
    { minimum: Number.NEGATIVE_INFINITY, score: 0 },
  ],

  /** I. RSI Health. Same broad plateau as RTT 2.0. Context only — never a qualification gate. */
  rsiHealth: {
    healthyMin: 45,
    healthyMax: 70,
    weakFloor: 30,
    overheatedCeiling: 85,
  },
} as const;
