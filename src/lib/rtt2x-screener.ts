import { calculateRtt2xScore } from "./rtt2x-score";
import type { ScoreComponent } from "./rtt-score";
import type { Rtt2xLiveRow } from "./rtt2x-live-data";

/**
 * Ranking, Top-10/Top-20, Emerging, and Recently-Weakened logic. Nothing
 * here introduces a new score — Top-10/Top-20 are plain RTT 2.X rank order,
 * and Emerging/Weakened are alternate READING lenses over RTT 2.X's own
 * already-computed component scores (or the same formula re-run on an
 * earlier slice of the same real candle history). RTT 2.X's rttScore itself
 * is never recomputed with different weights.
 */

function isQualifiedScored(row: Rtt2xLiveRow): boolean {
  return row.result.qualified && row.result.rttScore !== null;
}

/** All qualified, scored stocks ranked by RTT 2.X score descending (sector plays no part). */
export function rankByRttScore(rows: readonly Rtt2xLiveRow[]): Rtt2xLiveRow[] {
  return rows
    .filter(isQualifiedScored)
    .slice()
    .sort((a, b) => b.result.rttScore! - a.result.rttScore! || a.symbol.localeCompare(b.symbol));
}

export function topN(ranked: readonly Rtt2xLiveRow[], n: number): Rtt2xLiveRow[] {
  return ranked.slice(0, n);
}

function ratio(component: ScoreComponent): number {
  return component.score === null ? 0 : component.score / component.maximum;
}

const EMERGING_RESILIENCE_FLOOR_RATIO = 0.5;
const EMERGING_MIN_SCORE = 35;

/**
 * "Emerging" surfaces stocks developing the RTT 2.X trend-resilience pattern
 * that haven't yet accumulated a Top-20 score. Ranked by a composite of
 * Current Trend Development (weighted higher, since this is literally the
 * "becoming good" signal), EMA Slope & Expansion, 20 EMA Resilience, and
 * Extension/Entry Quality — all read directly from the RTT 2.X result, not a
 * new formula. A basic floor (resilience + a modest overall score minimum)
 * keeps genuinely weak/broken qualifiers out even if one sub-component
 * happens to look decent.
 */
export function buildEmergingList(ranked: readonly Rtt2xLiveRow[], top20: readonly Rtt2xLiveRow[], limit = 10): Rtt2xLiveRow[] {
  const top20Symbols = new Set(top20.map((row) => row.symbol));

  const candidates = ranked.filter((row) => {
    if (top20Symbols.has(row.symbol)) return false;
    if (ratio(row.result.ema20ResilienceScore) < EMERGING_RESILIENCE_FLOOR_RATIO) return false;
    if ((row.result.rttScore ?? 0) < EMERGING_MIN_SCORE) return false;
    return true;
  });

  function developingComposite(row: Rtt2xLiveRow): number {
    const r = row.result;
    return 2 * ratio(r.trendDevelopmentScore) + ratio(r.emaSlopeExpansionScore) + ratio(r.ema20ResilienceScore) + ratio(r.extensionScore);
  }

  return candidates
    .slice()
    .sort((a, b) => developingComposite(b) - developingComposite(a) || b.result.rttScore! - a.result.rttScore! || a.symbol.localeCompare(b.symbol))
    .slice(0, limit);
}

export type WeakenedRow = Rtt2xLiveRow & {
  priorRttScore: number;
  scoreDelta: number;
  lostQualification: boolean;
};

const WEAKENED_LOOKBACK_SESSIONS = 10;
const WEAKENED_MIN_HISTORY = 220;
const WEAKENED_SCORE_DROP_THRESHOLD = 8;
const WEAKENED_RESILIENCE_DROP_RATIO = 0.18;

/**
 * Monitoring-only view: stocks that WERE RTT-qualified with a real score
 * ~10 sessions ago (using the same already-fetched real candle history,
 * sliced earlier — no new API calls, no synthetic data) but have since lost
 * qualification, dropped meaningfully in score, or seen their 20 EMA
 * resilience deteriorate. This is not a sell signal — see the UI copy.
 */
export function buildRecentlyWeakenedList(rows: readonly Rtt2xLiveRow[], limit = 10): WeakenedRow[] {
  const flagged: WeakenedRow[] = [];

  for (const row of rows) {
    if (row.candles.length < WEAKENED_MIN_HISTORY + WEAKENED_LOOKBACK_SESSIONS) continue;

    const priorCandles = row.candles.slice(0, row.candles.length - WEAKENED_LOOKBACK_SESSIONS);
    let priorResult;
    try {
      priorResult = calculateRtt2xScore({ symbol: row.symbol, candles: priorCandles });
    } catch {
      continue;
    }
    if (!priorResult.qualified || priorResult.rttScore === null) continue;

    const lostQualification = !row.result.qualified;
    const scoreDelta = row.result.rttScore !== null ? row.result.rttScore - priorResult.rttScore : Number.NEGATIVE_INFINITY;
    const priorResilience = priorResult.ema20ResilienceScore.score;
    const currentResilience = row.result.ema20ResilienceScore.score;
    const resilienceDropped =
      priorResilience !== null && currentResilience !== null && priorResilience - currentResilience >= WEAKENED_RESILIENCE_DROP_RATIO * priorResult.ema20ResilienceScore.maximum;

    if (lostQualification || scoreDelta <= -WEAKENED_SCORE_DROP_THRESHOLD || resilienceDropped) {
      flagged.push({ ...row, priorRttScore: priorResult.rttScore, scoreDelta, lostQualification });
    }
  }

  return flagged.sort((a, b) => a.scoreDelta - b.scoreDelta).slice(0, limit);
}

export function filterBySector(rows: readonly Rtt2xLiveRow[], sector: string | "All"): Rtt2xLiveRow[] {
  return sector === "All" ? [...rows] : rows.filter((row) => row.sector === sector);
}
