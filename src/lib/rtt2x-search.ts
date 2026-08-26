import { RTT2X_UNIVERSE, type UniverseStock } from "./rtt2x-universe";

/**
 * Local, synchronous search over the existing RTT 2.X universe metadata
 * (symbol/company/sector only — no prices, scores, or candles). Never
 * touches the network: this is deliberately separate from the live-data
 * pipeline (rtt2x-live-data.ts), which only runs after a stock is selected.
 */

const DEFAULT_LIMIT = 8;

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Ranks a stock's relevance to an already-normalized, non-empty query.
 * Lower is more relevant; null means no match. Symbol/company exact and
 * prefix matches outrank sector matches and loose substring matches, per
 * the product spec ("divi" -> DIVISLAB before a looser sector match).
 */
function rank(stock: UniverseStock, query: string): number | null {
  const symbol = normalize(stock.symbol);
  const company = normalize(stock.companyName);
  const sector = normalize(stock.sector);

  if (symbol === query) return 0;
  if (symbol.startsWith(query)) return 1;
  if (company.startsWith(query)) return 2;
  if (sector.startsWith(query)) return 3;
  if (symbol.includes(query)) return 4;
  if (company.includes(query)) return 5;
  if (sector.includes(query)) return 6;
  return null;
}

/** Searches symbol, company name, and sector — case-insensitive, partial matches allowed. */
export function searchUniverse(query: string, limit = DEFAULT_LIMIT): UniverseStock[] {
  const normalized = normalize(query);
  if (!normalized) return [];

  return RTT2X_UNIVERSE.map((stock) => ({ stock, score: rank(stock, normalized) }))
    .filter((entry): entry is { stock: UniverseStock; score: number } => entry.score !== null)
    .sort((a, b) => a.score - b.score || a.stock.symbol.localeCompare(b.stock.symbol))
    .slice(0, limit)
    .map((entry) => entry.stock);
}

export type HighlightDirection = "up" | "down";

/** Pure keyboard-navigation index math for the search dropdown: clamps within [0, resultCount - 1]. */
export function moveHighlight(currentIndex: number, direction: HighlightDirection, resultCount: number): number {
  if (resultCount === 0) return -1;
  if (currentIndex < 0) return direction === "down" ? 0 : resultCount - 1;
  const next = direction === "down" ? currentIndex + 1 : currentIndex - 1;
  return Math.max(0, Math.min(next, resultCount - 1));
}

/** Resolves which result Enter should select: the highlighted one, falling back to the first result. */
export function resolveSelection(results: readonly UniverseStock[], highlightedIndex: number): UniverseStock | null {
  return results[highlightedIndex] ?? results[0] ?? null;
}
