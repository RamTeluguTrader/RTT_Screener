import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, ArrowUpDown, ArrowUpRight, BellPlus, SlidersHorizontal } from "lucide-react";
import { CreateAlertDialog } from "@/components/alerts/CreateAlertDialog";

import { buildRttDashboardData, type RttDashboardRow } from "@/lib/rtt-dashboard-data";
import { DEFAULT_SORT, nextSortState, sortDashboardRows, type SortColumn, type SortState } from "@/lib/rtt-table-sort";
import { inr } from "@/lib/market-data";
import { cn } from "@/lib/utils";

const topLimits = ["Top 10", "Top 20"] as const;

const SORTABLE_COLUMN_LABELS: Record<SortColumn, string> = {
  symbol: "Symbol",
  price: "Price",
  rsi: "RSI",
  rttScore: "RTT Score",
  classification: "Classification",
};

function SortableHeaderCell({
  column,
  align = "left",
  sort,
  onSort,
}: {
  column: SortColumn;
  align?: "left" | "right";
  sort: SortState;
  onSort: (column: SortColumn) => void;
}) {
  const active = sort.column === column;
  const ariaSort = active ? (sort.direction === "asc" ? "ascending" : "descending") : "none";

  return (
    <th className={cn("px-4 py-2.5 font-semibold", align === "right" && "text-right")} aria-sort={ariaSort}>
      <button
        type="button"
        onClick={() => onSort(column)}
        aria-label={`Sort by ${SORTABLE_COLUMN_LABELS[column]}`}
        className={cn(
          "inline-flex items-center gap-1 uppercase tracking-[0.12em] transition-colors hover:text-foreground",
          align === "right" && "flex-row-reverse",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        <span>{SORTABLE_COLUMN_LABELS[column]}</span>
        {active ? (
          sort.direction === "asc" ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
      </button>
    </th>
  );
}

function Score({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="text-[11px] text-muted-foreground">N/A</span>;
  }

  const tone = value >= 80 ? "bg-bull" : value >= 60 ? "bg-warn" : "bg-bear";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <span className="num text-xs font-semibold">{value.toFixed(0)}</span>
    </div>
  );
}

function ClassificationBadge({ value }: { value: string | null }) {
  const tone = value === "Exceptional" || value === "Strong"
    ? "text-bull ring-bull/30 bg-bull/10"
    : value === "Good" || value === "Watch"
      ? "text-warn ring-warn/30 bg-warn/10"
      : "text-bear ring-bear/30 bg-bear/10";

  return (
    <span className={cn("rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ring-1", tone)}>
      {value ?? "N/A"}
    </span>
  );
}

function DetailPanel({ row }: { row: RttDashboardRow }) {
  return (
    <div className="border-t border-border bg-surface/60 p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Selected stock</p>
          <h3 className="mt-1 text-sm font-semibold">{row.symbol} · {row.companyName}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{row.sector} · {inr(row.currentPrice)}</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-surface px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">RTT Score</p>
            <p className="num mt-1 text-sm font-semibold">{row.rttScore ?? "N/A"}</p>
          </div>
          <div className="rounded-lg border border-border bg-surface px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Classification</p>
            <div className="mt-1"><ClassificationBadge value={row.classification} /></div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="rounded-lg border border-border bg-surface/80 p-3">
          <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">RTT details</p>
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">RSI</p>
              <p className="num mt-1 font-medium">{row.rsi?.toFixed(1) ?? "N/A"}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Momentum</p>
              <p className="num mt-1 font-medium">{row.momentum?.toFixed(2) ?? "N/A"}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Volume</p>
              <p className="num mt-1 font-medium">{row.volume?.toFixed(2) ?? "N/A"}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">EMA status</p>
              <p className="mt-1 font-medium">{row.emaStatus}</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface/80 p-3">
          <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Qualitative signals</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {row.qualitativeSignals.map((signal) => (
              <li key={signal} className="rounded-md border border-border/60 bg-surface px-2.5 py-2">
                {signal}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-border bg-surface/80 p-3">
        <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Score breakdown</p>
        <div className="mt-3 space-y-2">
          {row.componentScores.map((component) => (
            <div key={component.label} className="flex flex-col gap-1 rounded-md border border-border/60 bg-surface px-2.5 py-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">{component.label}</p>
                <p className="text-[11px] text-muted-foreground">{component.explanation}</p>
              </div>
              <p className="num text-sm font-semibold">{component.score ?? "N/A"}/{component.maximum}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ScreenerTable() {
  const navigate = useNavigate();
  const [topLimit, setTopLimit] = useState<(typeof topLimits)[number]>("Top 10");
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);

  const dashboardData = useMemo(() => buildRttDashboardData(topLimit === "Top 10" ? 10 : 20), [topLimit]);
  const rows = dashboardData.qualifiedRows;
  const sortedRows = useMemo(() => sortDashboardRows(rows, sort), [rows, sort]);
  const selectedRow = sortedRows.find((row) => row.symbol === selectedSymbol) ?? sortedRows[0] ?? null;

  function handleSort(column: SortColumn) {
    setSort((current) => nextSortState(current, column));
  }

  return (
    <section className="panel overflow-hidden">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">RTT Qualified Screener</h2>
          <p className="truncate text-xs text-muted-foreground">
            {rows.length} qualified instruments · {dashboardData.totalStocks} instruments · Development Data
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="hidden rounded-lg border border-border bg-surface p-0.5 md:flex">
            {topLimits.map((limit) => (
              <button
                key={limit}
                onClick={() => setTopLimit(limit)}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                  topLimit === limit
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {limit}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled
            aria-label="Filter controls are not implemented in the development view"
            className="rounded-lg border border-border bg-surface p-2 text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="scroll-slim overflow-x-auto">
        <table className="w-full min-w-[1120px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              <th className="px-4 py-2.5 font-semibold">Rank</th>
              <SortableHeaderCell column="symbol" sort={sort} onSort={handleSort} />
              <th className="px-4 py-2.5 font-semibold">Company</th>
              <SortableHeaderCell column="price" align="right" sort={sort} onSort={handleSort} />
              <SortableHeaderCell column="rsi" align="right" sort={sort} onSort={handleSort} />
              <SortableHeaderCell column="rttScore" sort={sort} onSort={handleSort} />
              <SortableHeaderCell column="classification" sort={sort} onSort={handleSort} />
              <th className="px-4 py-2.5 font-semibold">EMA</th>
              <th className="px-4 py-2.5 font-semibold">Momentum</th>
              <th className="px-4 py-2.5 font-semibold">Volume</th>
              <th className="px-4 py-2.5 font-semibold">Sector</th>
              <th className="px-4 py-2.5 text-right font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => (
              <tr
                key={row.symbol}
                className="cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-accent/40"
                onClick={() => {
                  setSelectedSymbol(row.symbol);
                  navigate({ to: "/stock/$symbol", params: { symbol: row.symbol } });
                }}
              >
                <td className="px-4 py-3">
                  <span className="num text-xs font-semibold">#{row.rank}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className="num grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-raised text-[10px] font-semibold text-muted-foreground">
                      {row.symbol.slice(0, 2)}
                    </span>
                    <div className="min-w-0">
                      <p className="num truncate text-xs font-semibold">{row.symbol}</p>
                      <p className="truncate text-[10px] text-muted-foreground">{row.sector}</p>
                    </div>
                  </div>
                </td>
                <td className="max-w-[220px] px-4 py-3">
                  <p className="truncate text-xs text-muted-foreground">{row.companyName}</p>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="num text-xs font-semibold">{inr(row.currentPrice)}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="num text-xs font-semibold">{row.rsi?.toFixed(1) ?? "N/A"}</span>
                </td>
                <td className="px-4 py-3">
                  <Score value={row.rttScore} />
                </td>
                <td className="px-4 py-3">
                  <ClassificationBadge value={row.classification} />
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs text-muted-foreground">{row.emaStatus}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="num text-xs font-semibold">{row.momentum?.toFixed(2) ?? "N/A"}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="num text-xs font-semibold">{row.volume?.toFixed(2) ?? "N/A"}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs text-muted-foreground">{row.sector}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1.5">
                    <CreateAlertDialog
                      symbol={row.symbol}
                      source="scanner"
                      trigger={
                        <button
                          type="button"
                          aria-label={`Create alert for ${row.symbol}`}
                          onClick={(event) => event.stopPropagation()}
                          className="rounded-lg border border-border bg-surface p-1.5 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                        >
                          <BellPlus className="h-3.5 w-3.5" />
                        </button>
                      }
                    />
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        navigate({ to: "/stock/$symbol", params: { symbol: row.symbol } });
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium transition-colors hover:border-primary/40 hover:text-primary"
                    >
                      View
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedRow ? <DetailPanel row={selectedRow} /> : null}
    </section>
  );
}
