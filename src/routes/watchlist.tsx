import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";

import { AppShell } from "@/components/layout/AppShell";
import { WatchlistCard } from "@/components/watchlist/WatchlistCard";
import { WatchlistEmptyState } from "@/components/watchlist/WatchlistEmptyState";
import { useWatchlistData } from "@/hooks/use-watchlist-data";
import { useWatchlist, WATCHLIST_MAX } from "@/lib/watchlist-store";

const title = "My Watchlist — RTT Screener";
const description = "Stocks you're monitoring, tracked independently of Top 10, Top 20, and Emerging.";

export const Route = createFileRoute("/watchlist")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: WatchlistPage,
});

function WatchlistPage() {
  const symbols = useWatchlist();
  const entryMap = useWatchlistData(symbols);
  const entries = useMemo(() => symbols.map((symbol) => entryMap[symbol] ?? { symbol, status: "loading" as const, row: null, previousSnapshot: null }), [symbols, entryMap]);
  const isFull = symbols.length >= WATCHLIST_MAX;

  return (
    <AppShell title="My Watchlist" subtitle={`${symbols.length} / ${WATCHLIST_MAX} stocks`}>
      <div className="flex flex-col gap-4">
        <div className="panel flex flex-wrap items-center justify-between gap-2 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">My Watchlist</h2>
            <p className="text-xs text-muted-foreground">
              {symbols.length} / {WATCHLIST_MAX} stocks · stays independent of Top 10, Top 20, and Emerging
            </p>
          </div>
          {isFull ? (
            <p className="text-xs font-medium text-muted-foreground">Your watchlist is full. Remove a stock to add another.</p>
          ) : null}
        </div>

        {symbols.length === 0 ? (
          <WatchlistEmptyState />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {entries.map((entry) => (
              <WatchlistCard key={entry.symbol} entry={entry} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
