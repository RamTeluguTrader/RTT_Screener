import { createFileRoute } from "@tanstack/react-router";
import { BellPlus } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { CreateAlertDialog } from "@/components/alerts/CreateAlertDialog";

import { Panel, Delta } from "@/components/ui-kit/Panel";
import { Sparkline } from "@/components/ui-kit/Sparkline";
import { stocks, watchlist, inr } from "@/lib/market-data";

const title = "Watchlist — RTT Screener";
const description =
  "Track your shortlisted swing candidates with live prices, EMA posture and setup notes.";

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
  return (
    <AppShell title="Watchlist" subtitle="Five names on the desk, monitored tick by tick">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {watchlist.map((w) => {
          const s = stocks.find((x) => x.symbol === w.symbol);
          return (
            <Panel key={w.symbol}>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                <div className="min-w-0">
                  <p className="num truncate text-sm font-semibold">{w.symbol}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {s?.company ?? "NSE listed"}
                  </p>
                </div>
                {s && <Sparkline data={s.spark} positive={w.pct >= 0} />}
              </div>
              <div className="mt-4 flex items-end justify-between">
                <p className="num text-xl font-semibold">{inr(w.price)}</p>
                <Delta value={w.pct} className="text-sm" />
              </div>
              <p className="mt-3 rounded-lg border border-border bg-surface px-3 py-2 text-xs text-muted-foreground">
                {w.note}
              </p>
              <div className="mt-3">
                <CreateAlertDialog
                  symbol={w.symbol}
                  source="watchlist"
                  trigger={
                    <button className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-2 text-xs font-medium transition-colors hover:border-primary/40 hover:text-primary">
                      <BellPlus className="h-3.5 w-3.5" />
                      Create alert
                    </button>
                  }
                />
              </div>

            </Panel>
          );
        })}
      </div>
    </AppShell>
  );
}
