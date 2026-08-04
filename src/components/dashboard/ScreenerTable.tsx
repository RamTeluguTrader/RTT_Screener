import { useMemo, useState } from "react";
import { ArrowUpRight, SlidersHorizontal, BellPlus } from "lucide-react";
import { CreateAlertDialog } from "@/components/alerts/CreateAlertDialog";

import { stocks, inr, type EmaState, type Stock } from "@/lib/market-data";
import { Sparkline } from "@/components/ui-kit/Sparkline";
import { cn } from "@/lib/utils";

const filters = ["All setups", "EMA stacked", "Breakouts", "AI picks"] as const;

function EmaCell({ state }: { state: EmaState }) {
  const map = {
    above: { text: "text-bull", bg: "bg-bull/12 ring-bull/25", label: "▲" },
    below: { text: "text-bear", bg: "bg-bear/12 ring-bear/25", label: "▼" },
    cross: { text: "text-warn", bg: "bg-warn/12 ring-warn/25", label: "◆" },
  }[state];
  return (
    <span
      className={cn(
        "num inline-grid h-6 w-6 place-items-center rounded-md text-[10px] ring-1",
        map.text,
        map.bg,
      )}
      title={state}
    >
      {map.label}
    </span>
  );
}

function Score({ value }: { value: number }) {
  const tone = value >= 80 ? "bg-bull" : value >= 55 ? "bg-warn" : "bg-bear";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${value}%` }} />
      </div>
      <span className="num text-xs font-semibold">{value}</span>
    </div>
  );
}

function SignalBadge({ signal }: { signal: Stock["signal"] }) {
  const tone = {
    Buy: "text-bull ring-bull/30 bg-bull/10",
    Watch: "text-warn ring-warn/30 bg-warn/10",
    Avoid: "text-bear ring-bear/30 bg-bear/10",
  }[signal];
  return (
    <span
      className={cn(
        "rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ring-1",
        tone,
      )}
    >
      {signal}
    </span>
  );
}

export function ScreenerTable() {
  const [active, setActive] = useState<(typeof filters)[number]>("All setups");

  const rows = useMemo(() => {
    if (active === "EMA stacked")
      return stocks.filter((s) => Object.values(s.ema).every((v) => v === "above"));
    if (active === "Breakouts") return stocks.filter((s) => s.changePct > 1.5);
    if (active === "AI picks") return stocks.filter((s) => s.aiConfidence >= 80);
    return stocks;
  }, [active]);

  return (
    <section className="panel overflow-hidden">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">EMA Trend Screener</h2>
          <p className="truncate text-xs text-muted-foreground">
            {rows.length} instruments · refreshed 12s ago
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="hidden rounded-lg border border-border bg-surface p-0.5 md:flex">
            {filters.map((f) => (
              <button
                key={f}
                onClick={() => setActive(f)}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                  active === f
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {f}
              </button>
            ))}
          </div>
          <button className="rounded-lg border border-border bg-surface p-2 text-muted-foreground hover:text-foreground">
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="scroll-slim overflow-x-auto">
        <table className="w-full min-w-[1080px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              <th className="px-4 py-2.5 font-semibold">Stock</th>
              <th className="px-4 py-2.5 font-semibold">Company</th>
              <th className="px-4 py-2.5 text-right font-semibold">Live price</th>
              <th className="px-4 py-2.5 text-right font-semibold">Today</th>
              <th className="px-3 py-2.5 text-center font-semibold">10</th>
              <th className="px-3 py-2.5 text-center font-semibold">20</th>
              <th className="px-3 py-2.5 text-center font-semibold">50</th>
              <th className="px-3 py-2.5 text-center font-semibold">100</th>
              <th className="px-3 py-2.5 text-center font-semibold">200</th>
              <th className="px-4 py-2.5 font-semibold">Trend score</th>
              <th className="px-4 py-2.5 font-semibold">AI confidence</th>
              <th className="px-4 py-2.5 text-right font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr
                key={s.symbol}
                className="border-b border-border/60 transition-colors last:border-0 hover:bg-accent/40"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className="num grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-raised text-[10px] font-semibold text-muted-foreground">
                      {s.symbol.slice(0, 2)}
                    </span>
                    <div className="min-w-0">
                      <p className="num truncate text-xs font-semibold">{s.symbol}</p>
                      <p className="truncate text-[10px] text-muted-foreground">{s.sector}</p>
                    </div>
                  </div>
                </td>
                <td className="max-w-[220px] px-4 py-3">
                  <p className="truncate text-xs text-muted-foreground">{s.company}</p>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <Sparkline data={s.spark} positive={s.changePct >= 0} />
                    <span className="num text-xs font-semibold">{inr(s.price)}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <p
                    className={cn(
                      "num text-xs font-semibold",
                      s.changePct >= 0 ? "text-bull" : "text-bear",
                    )}
                  >
                    {s.changePct > 0 ? "+" : ""}
                    {s.changePct.toFixed(2)}%
                  </p>
                  <p className="num text-[10px] text-muted-foreground">
                    {s.change > 0 ? "+" : ""}
                    {s.change.toFixed(2)}
                  </p>
                </td>
                <td className="px-3 py-3 text-center">
                  <EmaCell state={s.ema.e10} />
                </td>
                <td className="px-3 py-3 text-center">
                  <EmaCell state={s.ema.e20} />
                </td>
                <td className="px-3 py-3 text-center">
                  <EmaCell state={s.ema.e50} />
                </td>
                <td className="px-3 py-3 text-center">
                  <EmaCell state={s.ema.e100} />
                </td>
                <td className="px-3 py-3 text-center">
                  <EmaCell state={s.ema.e200} />
                </td>
                <td className="px-4 py-3">
                  <Score value={s.trendScore} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <SignalBadge signal={s.signal} />
                    <span className="num text-xs text-muted-foreground">{s.aiConfidence}%</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1.5">
                    <CreateAlertDialog
                      symbol={s.symbol}
                      source="scanner"
                      trigger={
                        <button
                          aria-label={`Create alert for ${s.symbol}`}
                          className="rounded-lg border border-border bg-surface p-1.5 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                        >
                          <BellPlus className="h-3.5 w-3.5" />
                        </button>
                      }
                    />
                    <button className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium transition-colors hover:border-primary/40 hover:text-primary">
                      Trade
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>

              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
