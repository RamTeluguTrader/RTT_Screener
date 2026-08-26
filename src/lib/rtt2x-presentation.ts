import { classifyRttScore } from "./rtt-score";
import type { Rtt2xLiveRow } from "./rtt2x-live-data";
import type { WatchlistSnapshot } from "./watchlist-store";

/**
 * Shared user-facing terminology for RTT 2.X results — used by the stock
 * detail page, the screener table, and the Watchlist page, so the same
 * qualification result always reads the same way everywhere. Never exposes
 * the underlying EMA-ordering rule or raw rejection enum values (see the
 * pinned product-scope rule: no "alignment", no "qualification gate", no
 * "EMA10 > EMA20 > ...").
 */

type ScoreResult = Rtt2xLiveRow["result"];

/** User-facing trend-structure read — a presentation label only, never the underlying qualification rule. */
export function trendStructureLabel(result: ScoreResult): string {
  if (!result.qualified) return "Not yet established";
  switch (result.classification) {
    case "Exceptional":
    case "Strong":
      return "Strong trend";
    case "Good":
    case "Watch":
      return "Healthy trend";
    default:
      return "Developing trend";
  }
}

export function friendlyRejectionReason(reason: string | null): string {
  switch (reason) {
    case "EMA_ALIGNMENT_FAILED":
      return "Trend structure not yet established";
    case "INSUFFICIENT_DATA":
      return "Not enough price history available";
    case "INVALID_DATA":
      return "A data issue prevented scoring";
    default:
      return "Not qualified";
  }
}

/**
 * Describes the RTT score change since the last stored watchlist snapshot.
 * Purely descriptive (no recommendation) — matches the "Since last check"
 * framing required for the Watchlist page, since the snapshot is only ever
 * "the last time this page loaded data for this stock", not a real
 * historical/end-of-day close.
 */
export function describeScoreChange(currentScore: number | null, previous: WatchlistSnapshot | null): string {
  if (currentScore === null) return "Live analysis is temporarily unavailable for this stock.";
  if (!previous) return "First check — nothing to compare yet.";
  const delta = Math.round((currentScore - previous.score) * 10) / 10;
  if (Math.abs(delta) < 1) return "No major change since your last check.";
  const direction = delta > 0 ? "increased" : "decreased";
  return `RTT score ${direction} by ${Math.abs(delta).toFixed(1)} points since your last check.`;
}

/**
 * Describes a trend-structure change since the last snapshot, derived only
 * from the two scores (current + previously-stored) via the same
 * classification already used elsewhere — never a new formula. Returns null
 * when there's nothing meaningful to say (no prior snapshot, or the
 * classification band hasn't changed).
 */
export function describeTrendStructureChange(result: ScoreResult, previous: WatchlistSnapshot | null): string | null {
  if (!previous || result.rttScore === null || !result.qualified) return null;
  const previousClass = classifyRttScore(previous.score);
  if (previousClass === result.classification) return null;
  const label = (value: typeof previousClass) => (value === "Exceptional" || value === "Strong" ? "Strong" : value === "Good" || value === "Watch" ? "Healthy" : "Developing");
  return `Trend structure moved from ${label(previousClass)} to ${label(result.classification!)}.`;
}

/** Score delta formatted for display, e.g. "+5.2" / "-3.1" / null when there's nothing to compare. */
export function formatScoreDelta(currentScore: number | null, previous: WatchlistSnapshot | null): string | null {
  if (currentScore === null || !previous) return null;
  const delta = Math.round((currentScore - previous.score) * 10) / 10;
  return `${delta > 0 ? "+" : ""}${delta.toFixed(1)}`;
}
