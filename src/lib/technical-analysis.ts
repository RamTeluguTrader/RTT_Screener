export type Candle = {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export const EMA_PERIODS = [10, 20, 50, 100, 200] as const;

export type EmaPeriod = (typeof EMA_PERIODS)[number];

export type EmaPoint = {
  timestamp: number;
  value: number;
};

export type EmaResult = {
  period: EmaPeriod;
  values: readonly EmaPoint[];
  latest: EmaPoint | null;
  hasSufficientData: boolean;
};

export type StandardEmaResults = {
  ema10: EmaResult;
  ema20: EmaResult;
  ema50: EmaResult;
  ema100: EmaResult;
  ema200: EmaResult;
};

export type EmaValues = {
  ema10: number | null;
  ema20: number | null;
  ema50: number | null;
  ema100: number | null;
  ema200: number | null;
};

const CANDLE_NUMBER_FIELDS = ["timestamp", "open", "high", "low", "close", "volume"] as const;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validateCandles(candles: readonly Candle[]) {
  candles.forEach((candle, index) => {
    for (const field of CANDLE_NUMBER_FIELDS) {
      if (!isFiniteNumber(candle[field])) {
        throw new TypeError(`Invalid candle at index ${index}: ${field} must be a finite number.`);
      }
    }

    if (candle.volume < 0) {
      throw new TypeError(`Invalid candle at index ${index}: volume must not be negative.`);
    }
  });
}

/**
 * Calculates a closing-price EMA. The first EMA value is seeded with the
 * simple moving average for the requested period.
 */
export function calculateEma(candles: readonly Candle[], period: EmaPeriod): EmaResult {
  validateCandles(candles);

  if (candles.length < period) {
    return { period, values: [], latest: null, hasSufficientData: false };
  }

  const seedCloseTotal = candles.slice(0, period).reduce((total, candle) => total + candle.close, 0);
  const multiplier = 2 / (period + 1);
  let previousValue = seedCloseTotal / period;
  const values: EmaPoint[] = [{ timestamp: candles[period - 1]!.timestamp, value: previousValue }];

  for (let index = period; index < candles.length; index += 1) {
    const candle = candles[index]!;
    previousValue = (candle.close - previousValue) * multiplier + previousValue;
    values.push({ timestamp: candle.timestamp, value: previousValue });
  }

  return {
    period,
    values,
    latest: values.at(-1) ?? null,
    hasSufficientData: true,
  };
}

/** Calculates the five EMA periods used by the RTT screening strategy. */
export function calculateStandardEmas(candles: readonly Candle[]): StandardEmaResults {
  return {
    ema10: calculateEma(candles, 10),
    ema20: calculateEma(candles, 20),
    ema50: calculateEma(candles, 50),
    ema100: calculateEma(candles, 100),
    ema200: calculateEma(candles, 200),
  };
}

/** Extracts the latest values from a standard EMA result set. */
export function getLatestEmaValues(results: StandardEmaResults): EmaValues {
  return {
    ema10: results.ema10.latest?.value ?? null,
    ema20: results.ema20.latest?.value ?? null,
    ema50: results.ema50.latest?.value ?? null,
    ema100: results.ema100.latest?.value ?? null,
    ema200: results.ema200.latest?.value ?? null,
  };
}

/** Returns true only for a strict 10 > 20 > 50 > 100 > 200 EMA alignment. */
export function isEmaAligned(values: EmaValues): boolean {
  const orderedValues = [
    values.ema10,
    values.ema20,
    values.ema50,
    values.ema100,
    values.ema200,
  ];

  if (!orderedValues.every(isFiniteNumber)) {
    return false;
  }

  const [ema10, ema20, ema50, ema100, ema200] = orderedValues;

  return (
    ema10 > ema20 &&
    ema20 > ema50 &&
    ema50 > ema100 &&
    ema100 > ema200
  );
}

/** The RSI period used by the RTT screening strategy (the qualification band in rtt-config.ts assumes the classic 0-100 Wilder scale). */
export const RSI_PERIOD = 14;

export type RsiPoint = {
  timestamp: number;
  value: number;
};

export type RsiResult = {
  period: number;
  values: readonly RsiPoint[];
  latest: RsiPoint | null;
  hasSufficientData: boolean;
};

/**
 * Converts a period's average gain/loss into an RSI value using the classic
 * Wilder formula `100 - 100 / (1 + averageGain / averageLoss)`.
 *
 * Edge case, chosen and documented explicitly (no other convention is
 * implied elsewhere in this codebase): when there is no price movement at
 * all in the smoothing window (both averages are exactly zero), RSI is
 * reported as 50 — a neutral reading — rather than left as an undefined
 * 0/0, matching common charting-platform behavior for a flat series. When
 * only the average loss is zero, RSI is 100 (maximum, no downside at all).
 */
function rsiFromAverages(averageGain: number, averageLoss: number): number {
  if (averageGain === 0 && averageLoss === 0) return 50;
  if (averageLoss === 0) return 100;
  const relativeStrength = averageGain / averageLoss;
  return 100 - 100 / (1 + relativeStrength);
}

/**
 * Calculates a closing-price RSI using Wilder's original smoothing method
 * (the industry-standard RSI convention, and the one implied by this app's
 * 50-75 qualification band on the classic 0-100 scale — see rtt-config.ts).
 *
 * The first average gain/loss is seeded with a simple average over the
 * first `period` closing-price changes (requiring `period + 1` candles),
 * then smoothed forward with Wilder's recursive formula:
 *   average = (previousAverage * (period - 1) + current) / period
 *
 * Does not mutate the input candles.
 */
export function calculateRsi(candles: readonly Candle[], period: number = RSI_PERIOD): RsiResult {
  validateCandles(candles);

  if (candles.length < period + 1) {
    return { period, values: [], latest: null, hasSufficientData: false };
  }

  const changes: number[] = [];
  for (let index = 1; index < candles.length; index += 1) {
    changes.push(candles[index]!.close - candles[index - 1]!.close);
  }

  let averageGain = changes.slice(0, period).reduce((total, change) => total + Math.max(change, 0), 0) / period;
  let averageLoss = changes.slice(0, period).reduce((total, change) => total + Math.max(-change, 0), 0) / period;

  const values: RsiPoint[] = [
    { timestamp: candles[period]!.timestamp, value: rsiFromAverages(averageGain, averageLoss) },
  ];

  for (let index = period; index < changes.length; index += 1) {
    const change = changes[index]!;
    const gain = Math.max(change, 0);
    const loss = Math.max(-change, 0);
    averageGain = (averageGain * (period - 1) + gain) / period;
    averageLoss = (averageLoss * (period - 1) + loss) / period;
    values.push({ timestamp: candles[index + 1]!.timestamp, value: rsiFromAverages(averageGain, averageLoss) });
  }

  return {
    period,
    values,
    latest: values.at(-1) ?? null,
    hasSufficientData: true,
  };
}

/** Extracts the latest RSI14 value from a calculateRsi() result, or null when there isn't enough data — mirrors getLatestEmaValues(). */
export function getLatestRsiValue(result: RsiResult): number | null {
  return result.latest?.value ?? null;
}
