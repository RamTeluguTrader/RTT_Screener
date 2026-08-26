import { TrendingUp, TrendingDown, Newspaper, ScanSearch } from "lucide-react";
import { topGainers, topLosers, news, inr } from "@/lib/market-data";
import { Panel, Delta } from "@/components/ui-kit/Panel";

function MoverList({ items }: { items: { symbol: string; pct: number; price: number }[] }) {
  return (
    <ul className="divide-y divide-border">
      {items.map((m) => (
        <li key={m.symbol} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2.5">
          <div className="min-w-0">
            <p className="num truncate text-xs font-semibold">{m.symbol}</p>
            <p className="num truncate text-[10px] text-muted-foreground">{inr(m.price)}</p>
          </div>
          <Delta value={m.pct} />
        </li>
      ))}
    </ul>
  );
}

export function MarketRail() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-1">
        <Panel
          title="Top Gainers"
          action={<TrendingUp className="h-4 w-4 text-bull" />}
          bodyClassName="px-4 py-1"
        >
          <MoverList items={topGainers} />
        </Panel>
        <Panel
          title="Top Losers"
          action={<TrendingDown className="h-4 w-4 text-bear" />}
          bodyClassName="px-4 py-1"
        >
          <MoverList items={topLosers} />
        </Panel>
      </div>

      <Panel
        title="Market News"
        action={<Newspaper className="h-4 w-4 text-muted-foreground" />}
        bodyClassName="px-4 py-1"
      >
        <ul className="divide-y divide-border">
          {news.map((n) => (
            <li key={n.title} className="py-3">
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span className="num">{n.time}</span>
                <span className="h-1 w-1 rounded-full bg-border-strong" />
                <span>{n.source}</span>
                <span className="ml-auto rounded-md bg-surface-raised px-1.5 py-0.5">{n.tag}</span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-foreground/90">{n.title}</p>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Research Notes" action={<ScanSearch className="h-4 w-4 text-primary" />}>
        <div className="flex flex-col gap-3">
          <div className="rounded-lg border border-border bg-surface p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Screener context</p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
              RTT results highlight technical structure and qualification context for review.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Technical focus</p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
              The dashboard remains focused on score breakdowns, trend structure, and sector context.
            </p>
          </div>
        </div>
      </Panel>
    </div>
  );
}
