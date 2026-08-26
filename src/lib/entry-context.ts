import type { Candle } from "./technical-analysis";

/**
 * Entry Context — a presentation-only lens over data the RTT 2.X pipeline
 * has already fetched and computed (candles, current price, distance from
 * EMA20). It answers "how stretched is the current price relative to EMA20
 * and the 52-week high?", never "how strong is the trend?" (that's RTT
 * Score). Nothing here feeds back into rtt2x-score.ts, rtt2x-config.ts,
 * qualification, ranking, or the Top 10/Top 20/Emerging/Recently Weakened
 * lists — it is computed independently at render time from data already in
 * hand, so it never triggers an additional Upstox request and never changes
 * the RTT score. See the shared product-scope rule: never a buy/sell
 * signal or recommendation, factual/descriptive language only.
 */

export type EntryContext = "Favorable Context" | "Extended — Watch for Pullback" | "Highly Extended" | "Neutral";

export const ENTRY_CONTEXT_EMOJI: Record<EntryContext, string> = {
  "Favorable Context": "🟢",
  "Extended — Watch for Pullback": "🟡",
  "Highly Extended": "🟠",
  Neutral: "⚪",
};

/**
 * Compact label for dense contexts (the Scanner table), so a row stays
 * roughly one line tall. The full label (this record's key) remains
 * available via native title/aria-label hover text wherever this is used —
 * this is a display-only mapping over the same EntryContext value, never a
 * second classification.
 */
export const ENTRY_CONTEXT_COMPACT_LABEL: Record<EntryContext, string> = {
  "Favorable Context": "Favorable",
  "Extended — Watch for Pullback": "Extended",
  "Highly Extended": "Highly Extended",
  Neutral: "Neutral",
};

const TRAILING_SESSIONS_52W = 252;

/**
 * Highest candle high over the trailing 252 completed sessions available in
 * `candles` (which is always chronologically ascending, oldest to newest —
 * see upstox-proxy-shared.ts). Only ever looks at the sessions actually
 * passed in, so a caller that hands in a truncated history (e.g. an earlier
 * evaluation date) never sees a later, "future" high. Returns null when
 * fewer than 252 sessions are available — never an invented/partial high.
 */
export function calculate52WeekHigh(candles: readonly Candle[]): number | null {
  if (candles.length < TRAILING_SESSIONS_52W) return null;
  const window = candles.slice(candles.length - TRAILING_SESSIONS_52W);
  return window.reduce((max, candle) => Math.max(max, candle.high), Number.NEGATIVE_INFINITY);
}

/** ((currentPrice - 52WHigh) / 52WHigh) * 100 — 0% at the high, negative below it. */
export function calculateDistanceFrom52WHighPct(currentPrice: number | null, high52Week: number | null): number | null {
  if (currentPrice === null || high52Week === null || high52Week <= 0) return null;
  return ((currentPrice - high52Week) / high52Week) * 100;
}

/**
 * Final classification, applied in exact priority order (Highly Extended ->
 * Extended -> Favorable -> Neutral). Unavailable inputs (either distance
 * could not be computed, e.g. insufficient 252-session history) always
 * resolve to Neutral rather than guessing.
 */
export function classifyEntryContext(distanceFromEma20Pct: number | null, distanceFrom52WHighPct: number | null): EntryContext {
  if (distanceFromEma20Pct === null || distanceFrom52WHighPct === null) return "Neutral";

  if (distanceFromEma20Pct > 12) return "Highly Extended";
  if (distanceFromEma20Pct > 5 && distanceFrom52WHighPct >= -2) return "Highly Extended";

  if (distanceFromEma20Pct > 5 && distanceFromEma20Pct <= 12) return "Extended — Watch for Pullback";
  if (distanceFrom52WHighPct >= -5) return "Extended — Watch for Pullback";

  if (distanceFromEma20Pct >= 0 && distanceFromEma20Pct <= 5 && distanceFrom52WHighPct < -5) return "Favorable Context";

  return "Neutral";
}

export type EntryContextResult = {
  context: EntryContext;
  distanceFromEma20Pct: number | null;
  distanceFrom52WHighPct: number | null;
  high52Week: number | null;
};

/**
 * Computes Entry Context for a stock from data the screener already holds
 * (no new fetch). `distanceFromEma20Pct` is the same value already shown
 * elsewhere in the UI (Rtt2xLiveRow.distanceFromEma20) — reused as-is, never
 * recomputed differently here.
 */
export function getEntryContext(row: { candles: readonly Candle[]; currentPrice: number | null; distanceFromEma20: number | null }): EntryContextResult {
  const high52Week = calculate52WeekHigh(row.candles);
  const distanceFrom52WHighPct = calculateDistanceFrom52WHighPct(row.currentPrice, high52Week);
  const context = classifyEntryContext(row.distanceFromEma20, distanceFrom52WHighPct);
  return { context, distanceFromEma20Pct: row.distanceFromEma20, distanceFrom52WHighPct, high52Week };
}

/** Factual, non-prescriptive description — never an instruction to act. */
export function entryContextExplanation(result: EntryContextResult): string {
  const { distanceFromEma20Pct, distanceFrom52WHighPct } = result;
  if (distanceFromEma20Pct === null) return "Not enough data to describe current price positioning.";

  const emaPart = `Price is ${Math.abs(distanceFromEma20Pct).toFixed(1)}% ${distanceFromEma20Pct >= 0 ? "above" : "below"} EMA20`;
  if (distanceFrom52WHighPct === null) {
    return `${emaPart}. Not enough price history to determine distance from the 52-week high.`;
  }

  const highPart =
    distanceFrom52WHighPct >= -2
      ? "within 2% of its 52-week high"
      : distanceFrom52WHighPct >= -5
        ? "within 5% of its 52-week high"
        : `${Math.abs(distanceFrom52WHighPct).toFixed(1)}% below its 52-week high`;

  return `${emaPart} and ${highPart}.`;
}
