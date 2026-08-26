/**
 * RTT 2.0 scoring configuration — approved design (see project design-checkpoint
 * conversation). A parallel, independent model to RTT 1.0 (rtt-config.ts /
 * rtt-score.ts), which remains untouched. Weights sum to exactly 100.
 *
 * Sector Strength is intentionally NOT part of this config/weights — it is
 * preserved only as a separate contextual metric (see rtt2-score.ts).
 */
export const RTT2_SCORE_CONFIG = {
  weights: {
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
  },

  /** Component 1: EMA Structure. Same algorithm as RTT 1.0's emaStack, reweighted. */
  emaStructure: { targetAverageSeparationPercent: 5 },

  /** Component 2: EMA Slope & Expansion. Uses EMA20/50/100/200 (not EMA10). */
  slopeExpansion: {
    lookback: 10,
    slopePointsMax: 7.5,
    slopeTargetPercent: 3,
    expansionPointsMax: 7.5,
    expansionTargetPercent: 1.5,
  },

  /** Component 3: Early Trend Development. Acceleration-based, not age-based. */
  earlyTrendDevelopment: {
    transitionPoints: 3,
    transitionLookback: 10,
    slopeAccelPoints: 4,
    slopeAccelWindow: 5,
    slopeAccelTargetPercent: 2,
    expansionAccelPoints: 4,
    expansionAccelWindow: 5,
    expansionAccelTargetPercent: 0.75,
    hhhlPoints: 2,
    hhhlWindow: 10,
    priceAccelPoints: 2,
    priceAccelWindow: 5,
    priceAccelTargetPercent: 3,
  },

  /** Component 4: 20 EMA Trend Support. Continuous, recency-weighted, no hard floor. */
  ema20Support: {
    window: 30,
    weightedPctPoints: 7,
    penetrationPoints: 4,
    penetrationTargetPercent: 3,
    recoveryPoints: 3,
    recoveryWithinSessions: 3,
    currentPositionPoints: 2,
    currentPositionTaperPercent: 3,
  },

  /** Component 5: 50 EMA Structural Support. Longer window, stricter floor, worst-case penetration. */
  ema50Support: {
    window: 60,
    pctAbovePoints: 7,
    pctAboveFloorPercent: 60,
    pctAboveCeilingPercent: 95,
    penetrationPoints: 3,
    worstPenetrationTargetPercent: 5,
  },

  /** Component 6: Momentum. Same 20-day measure as RTT 1.0, rebanded to a 10-pt max. */
  momentum20d: [
    { minimumPercent: 10, score: 10 },
    { minimumPercent: 7.5, score: 8 },
    { minimumPercent: 5, score: 6 },
    { minimumPercent: 2.5, score: 4 },
    { minimumPercent: 0, score: 2 },
    { minimumPercent: Number.NEGATIVE_INFINITY, score: 0 },
  ],

  /** Component 7: Breakout / Base Quality. Mechanical, measurable, no pattern recognition. */
  breakoutBaseQuality: {
    baseWindow: 15,
    breakoutWindow: 8,
    tightnessPoints: 2,
    tightnessTargetPercent: 8,
    breakoutPoints: 2,
    freshnessPoints: 2,
    freshnessMaxSessions: 7,
    distancePoints: 2,
    distanceTargetPercent: 12,
    confirmationPoints: 1,
    volumePoints: 1,
    volumeMultiplier: 1.5,
  },

  /** Component 8: Volume Confirmation. Same RVOL measure as RTT 1.0, rebanded to a 5-pt max. */
  relativeVolume: [
    { minimum: 2, score: 5 },
    { minimum: 1.5, score: 4 },
    { minimum: 1.25, score: 3 },
    { minimum: 1, score: 2 },
    { minimum: 0.75, score: 1 },
    { minimum: Number.NEGATIVE_INFINITY, score: 0 },
  ],

  /** Component 9: RSI Health. Broad plateau, never a qualification gate. */
  rsiHealth: {
    healthyMin: 45,
    healthyMax: 70,
    weakFloor: 30,
    overheatedCeiling: 85,
  },

  /** Component 10: Extension / Entry Quality. Symmetric around EMA20. */
  extension: {
    taperPercent: 7,
  },
} as const;
