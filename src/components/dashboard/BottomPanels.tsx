import { breadth, sectors, watchlist, inr } from "@/lib/market-data";
import { Panel, Delta } from "@/components/ui-kit/Panel";
import { cn } from "@/lib/utils";

export function BottomPanels() {
  const total = breadth.advancing + breadth.declining + breadth.unchanged;
  const advPct = (breadth.advancing / total) * 100;

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <Panel title="Market Breadth">
        <div className="flex items-end justify-between">
          <div>
            <p className="num text-2xl font-semibold text-bull">{breadth.advancing}</p>
            <p className="text-[11px] text-muted-foreground">Advancing</p>
          </div>
          <div className="text-right">
            <p className="num text-2xl font-semibold text-bear">{breadth.declining}</p>
            <p className="text-[11px] text-muted-foreground">Declining</p>
          </div>
        </div>
        <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-bull" style={{ width: `${advPct}%` }} />
          <div className="h-full flex-1 bg-bear" />
        </div>
        <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[
            ["New highs", breadth.newHighs],
            ["New lows", breadth.newLows],
            ["Above 200 EMA", `${breadth.aboveEma200}%`],
          ].map(([k, v]) => (
            <div key={String(k)} className="rounded-lg border border-border bg-surface px-2 py-2.5">
              <dd className="num text-sm font-semibold">{v}</dd>
              <dt className="mt-0.5 text-[10px] text-muted-foreground">{k}</dt>
            </div>
          ))}
        </dl>
      </Panel>

      <Panel title="Sector Strength">
        <ul className="flex flex-col gap-2.5">
          {sectors.map((s) => (
            <li key={s.name} className="grid grid-cols-[92px_minmax(0,1fr)_54px] items-center gap-3">
              <span className="truncate text-xs text-muted-foreground">{s.name}</span>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full", s.change >= 0 ? "bg-primary" : "bg-bear")}
                  style={{ width: `${s.strength}%` }}
                />
              </div>
              <Delta value={s.change} className="text-right" />
            </li>
          ))}
        </ul>
      </Panel>

      <Panel
        title="Watchlist"
        action={<span className="text-[10px] text-muted-foreground">5 tracked</span>}
        bodyClassName="px-4 py-1"
      >
        <ul className="divide-y divide-border">
          {watchlist.map((w) => (
            <li
              key={w.symbol}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="num truncate text-xs font-semibold">{w.symbol}</p>
                <p className="truncate text-[10px] text-muted-foreground">{w.note}</p>
              </div>
              <div className="text-right">
                <p className="num text-xs font-semibold">{inr(w.price)}</p>
                <Delta value={w.pct} className="text-[10px]" />
              </div>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
