import { useEffect, useRef, useState } from "react";
import { loadRtt2xStockDetail, type Rtt2xLiveRow } from "@/lib/rtt2x-live-data";
import { mapWithConcurrency } from "@/lib/upstox-client";
import { getWatchlistSnapshot, updateWatchlistSnapshot, type WatchlistSnapshot } from "@/lib/watchlist-store";

/**
 * Loads current RTT 2.X data for every watchlisted symbol via the existing,
 * unmodified live-data pipeline (loadRtt2xStockDetail — the same function
 * the stock-detail page uses; no duplicated scoring, no new formula). A
 * failure on one symbol never removes it or blocks the others. Runs once per
 * distinct symbol set (page open/refresh) — no polling.
 */

const FETCH_CONCURRENCY = 6;

export type WatchlistEntryStatus = "loading" | "ready" | "error";

export type WatchlistEntry = {
  symbol: string;
  status: WatchlistEntryStatus;
  row: Rtt2xLiveRow | null;
  previousSnapshot: WatchlistSnapshot | null;
};

export function useWatchlistData(symbols: readonly string[]) {
  const [entries, setEntries] = useState<Record<string, WatchlistEntry>>({});
  const requestIdRef = useRef(0);

  useEffect(() => {
    const requestId = ++requestIdRef.current;

    setEntries((previous) => {
      const next: Record<string, WatchlistEntry> = {};
      for (const symbol of symbols) {
        const existing = previous[symbol];
        next[symbol] =
          existing && existing.status !== "loading"
            ? existing
            : { symbol, status: "loading", row: null, previousSnapshot: getWatchlistSnapshot(symbol) };
      }
      return next;
    });

    if (symbols.length === 0) return;

    (async () => {
      const results = await mapWithConcurrency(symbols, FETCH_CONCURRENCY, async (symbol) => {
        const previousSnapshot = getWatchlistSnapshot(symbol);
        const result = await loadRtt2xStockDetail(symbol);
        return { symbol, result, previousSnapshot };
      });

      if (requestIdRef.current !== requestId) return; // a newer load superseded this one

      setEntries((previous) => {
        const next = { ...previous };
        for (const { symbol, result, previousSnapshot } of results) {
          if (result.ok) {
            if (result.row.result.rttScore !== null) {
              updateWatchlistSnapshot(symbol, result.row.result.rttScore);
            }
            next[symbol] = { symbol, status: "ready", row: result.row, previousSnapshot };
          } else {
            next[symbol] = { symbol, status: "error", row: null, previousSnapshot };
          }
        }
        return next;
      });
    })();
    // `symbols` (from useWatchlist()) is referentially stable between actual
    // add/remove mutations, so depending on it directly is safe and correct.
  }, [symbols]);

  return entries;
}
