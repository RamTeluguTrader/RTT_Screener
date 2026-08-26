import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, ArrowUpDown, ArrowUpRight, BellPlus, RefreshCw } from "lucide-react";
import { CreateAlertDialog } from "@/components/alerts/CreateAlertDialog";
import { WatchlistButton } from "@/components/watchlist/WatchlistButton";

import { useRtt2xUniverse } from "@/hooks/use-rtt2x-universe";
import type { Rtt2xLiveRow } from "@/lib/rtt2x-live-data";
import { buildEmergingList, buildRecentlyWeakenedList, filterBySector, rankByRttScore, topN, type WeakenedRow } from "@/lib/rtt2x-screener";
import { DEFAULT_RTT2X_SORT, nextRtt2xSortState, sortRtt2xRows, type Rtt2xSortColumn, type Rtt2xSortState } from "@/lib/rtt2x-table-sort";
import { SECTOR_NAMES } from "@/lib/rtt2x-universe";
import { inr } from "@/lib/market-data";
import { cn } from "@/lib/utils";

export type SectionKey = "top10" | "top20" | "emerging" | "weakened";

const SECTIONS: { key: SectionKey; label: string }[] = [
  { key: "top10", label: "Top 10 — Best Setups" },
  { key: "top20", label: "Top 20 — Watchlist" },
  { key: "emerging", label: "Emerging" },
  { key: "weakened", label: "Recently Weakened" },
];

const SORTABLE_COLUMN_LABELS: Record<Rtt2xSortColumn, string> = {
  symbol: "Symbol",
  price: "Price",
  rttScore: "RTT Score",
  momentum: "20D Momentum",
  rsi: "RSI",
  rvol: "RVOL",
};

function SortableHeaderCell({
  column,
  align = "left",
  sort,
  onSort,
}: {
  column: Rtt2xSortColumn;
  align?: "left" | "right";
  sort: Rtt2xSortState;
  onSort: (column: Rtt2xSortColumn) => void;
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
        {active ? sort.direction === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" /> : <ArrowUpDown className="h-3 w-3 opacity-40" />}
      </button>
    </th>
  );
}

function ScoreBar({ value }: { value: number | null }) {
  if (value === null) return <span className="text-[11px] text-muted-foreground">N/A</span>;
  const tone = value >= 70 ? "bg-bull" : value >= 45 ? "bg-warn" : "bg-bear";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <span className="num text-xs font-semibold">{value.toFixed(1)}</span>
    </div>
  );
}

function resilienceLabel(row: Rtt2xLiveRow): { label: string; tone: string } {
  const c = row.result.ema20ResilienceScore;
  const ratio = c.score === null ? null : c.score / c.maximum;
  if (ratio === null) return { label: "N/A", tone: "text-muted-foreground ring-border bg-surface" };
  if (ratio >= 0.7) return { label: "Resilient", tone: "text-bull ring-bull/30 bg-bull/10" };
  if (ratio >= 0.4) return { label: "Developing", tone: "text-warn ring-warn/30 bg-warn/10" };
  return { label: "Fragile", tone: "text-bear ring-bear/30 bg-bear/10" };
}

function ResilienceBadge({ row }: { row: Rtt2xLiveRow }) {
  const { label, tone } = resilienceLabel(row);
  return <span className={cn("rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ring-1", tone)}>{label}</span>;
}

function isWeakenedRow(row: Rtt2xLiveRow): row is WeakenedRow {
  return "scoreDelta" in row;
}

/** User-facing trend read — a presentation label only, never the underlying qualification rule. */
function trendLabel(row: Rtt2xLiveRow): string {
  if (!row.result.qualified) return "Developing";
  switch (row.result.classification) {
    case "Exceptional":
    case "Strong":
      return "Strong";
    case "Good":
    case "Watch":
      return "Healthy";
    default:
      return "Developing";
  }
}

const COMPONENT_ROWS: { key: keyof Rtt2xLiveRow["result"]; label: string; explanation: string }[] = [
  { key: "ema20ResilienceScore", label: "20 EMA Trend Resilience", explanation: "How well price has respected the 20 EMA recently — tolerant of shallow dips, penalized by deep or frequent breaks." },
  { key: "emaStructureScore", label: "EMA Structure Quality", explanation: "How widely separated the EMA stack is — wider separation reflects a stronger trend." },
  { key: "emaSlopeExpansionScore", label: "EMA Slope & Expansion", explanation: "Whether the EMA stack is currently rising and widening." },
  { key: "ema50ResilienceScore", label: "50 EMA Structural Resilience", explanation: "Longer-term structural integrity relative to the 50 EMA, including its own slope." },
  { key: "trendDevelopmentScore", label: "Current Trend Development", explanation: "Present-tense trend quality — current EMA20 pace, recent higher-highs/lows, and current stack widening." },
  { key: "momentumScore", label: "Momentum", explanation: "20-day price momentum — a supporting factor, not the dominant one." },
  { key: "extensionScore", label: "Entry / Extension Quality", explanation: "How close price is to the 20 EMA — peaks near it, tapers off the further extended price becomes." },
  { key: "volumeScore", label: "Volume Confirmation", explanation: "Relative volume versus the recent average — confirmation only, never required." },
  { key: "rsiHealthScore", label: "RSI Health", explanation: "Whether RSI sits in a healthy range — context only, not a requirement on its own." },
];

function DetailPanel({ row }: { row: Rtt2xLiveRow }) {
  const r = row.result;
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
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">RTT 2.X Score</p>
            <p className="num mt-1 text-sm font-semibold">{r.rttScore ?? "N/A"}/100</p>
          </div>
          <div className="rounded-lg border border-border bg-surface px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Trend resilience</p>
            <div className="mt-1"><ResilienceBadge row={row} /></div>
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-border bg-surface/80 p-3">
        <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Component breakdown</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {COMPONENT_ROWS.map((component) => {
            const value = r[component.key];
            if (typeof value !== "object" || value === null || !("score" in value)) return null;
            return (
              <div key={String(component.key)} className="flex flex-col gap-1 rounded-md border border-border/60 bg-surface px-2.5 py-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{component.label}</p>
                  <p className="num text-sm font-semibold">{value.score ?? "N/A"}/{value.maximum}</p>
                </div>
                <p className="text-[11px] text-muted-foreground">{component.explanation}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function ScreenerTable({ initialSection }: { initialSection?: SectionKey } = {}) {
  const navigate = useNavigate();
  const { rows, failedCount, status, errorMessage, refresh } = useRtt2xUniverse();
  const [section, setSection] = useState<SectionKey>(initialSection ?? "top10");
  const [sectorFilter, setSectorFilter] = useState<string | "All">("All");
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [sort, setSort] = useState<Rtt2xSortState>(DEFAULT_RTT2X_SORT);

  const ranked = useMemo(() => rankByRttScore(rows), [rows]);
  const top10 = useMemo(() => topN(ranked, 10), [ranked]);
  const top20 = useMemo(() => topN(ranked, 20), [ranked]);
  const emerging = useMemo(() => buildEmergingList(ranked, top20), [ranked, top20]);
  const weakened = useMemo(() => buildRecentlyWeakenedList(rows), [rows]);

  const sectionRows: readonly Rtt2xLiveRow[] = section === "top10" ? top10 : section === "top20" ? top20 : section === "emerging" ? emerging : weakened;
  const filteredRows = useMemo(() => filterBySector(sectionRows, sectorFilter), [sectionRows, sectorFilter]);
  const sortedRows = useMemo(() => sortRtt2xRows(filteredRows, sort), [filteredRows, sort]);
  const selectedRow = sortedRows.find((row) => row.symbol === selectedSymbol) ?? sortedRows[0] ?? null;

  function handleSort(column: Rtt2xSortColumn) {
    setSort((current) => nextRtt2xSortState(current, column));
  }

  const isWeakenedSection = section === "weakened";

  return (
    <section className="panel overflow-hidden">
      <header className="flex flex-col gap-3 border-b border-border px-4 py-3">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">RTT 2.X Screener</h2>
            <p className="truncate text-xs text-muted-foreground">
              {status === "loading"
                ? "Loading real NSE market data from Upstox…"
                : status === "error"
                  ? (errorMessage ?? "Unable to load market data.")
                  : `${ranked.length} qualified of ${rows.length} instruments${failedCount > 0 ? ` · ${failedCount} unavailable` : ""}`}
            </p>
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={status === "loading"}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", status === "loading" && "animate-spin")} />
            Refresh
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap rounded-lg border border-border bg-surface p-0.5">
            {SECTIONS.map((s) => (
              <button
                key={s.key}
                onClick={() => setSection(s.key)}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                  section === s.key ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="scroll-slim flex flex-wrap items-center gap-1.5">
            {(["All", ...SECTOR_NAMES] as const).map((sector) => (
              <button
                key={sector}
                onClick={() => setSectorFilter(sector)}
                className={cn(
                  "rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
                  sectorFilter === sector
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {sector}
              </button>
            ))}
          </div>
        </div>

        {section === "emerging" && (
          <p className="text-[11px] text-muted-foreground">
            Stocks developing the RTT trend-resilience pattern, ranked separately from Top 20 — not simply the next-highest scores.
          </p>
        )}
        {isWeakenedSection && (
          <p className="text-[11px] text-muted-foreground">
            Monitoring only, not a trading signal: stocks that recently qualified but whose technical structure has since deteriorated.
          </p>
        )}
      </header>

      {status === "error" ? (
        <div className="p-6 text-sm text-muted-foreground">
          {errorMessage ?? "Unable to load market data."}
        </div>
      ) : (
        <>
          <div className="scroll-slim overflow-x-auto">
            <table className="w-full min-w-[1180px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  <th className="px-4 py-2.5 font-semibold">Rank</th>
                  <SortableHeaderCell column="symbol" sort={sort} onSort={handleSort} />
                  <th className="px-4 py-2.5 font-semibold">Company</th>
                  <SortableHeaderCell column="price" align="right" sort={sort} onSort={handleSort} />
                  <SortableHeaderCell column="rttScore" sort={sort} onSort={handleSort} />
                  <th className="px-4 py-2.5 font-semibold">Trend</th>
                  <SortableHeaderCell column="momentum" align="right" sort={sort} onSort={handleSort} />
                  <SortableHeaderCell column="rsi" align="right" sort={sort} onSort={handleSort} />
                  <SortableHeaderCell column="rvol" align="right" sort={sort} onSort={handleSort} />
                  <th className="px-4 py-2.5 font-semibold">Resilience</th>
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
                      <span className="num text-xs font-semibold">#{ranked.findIndex((r) => r.symbol === row.symbol) + 1 || "—"}</span>
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
                    <td className="px-4 py-3">
                      <ScoreBar value={row.result.rttScore} />
                      {isWeakenedRow(row) ? (
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          was {row.priorRttScore}, {Number.isFinite(row.scoreDelta) ? `${row.scoreDelta.toFixed(1)} pts` : "no longer qualifies"}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("text-xs font-medium", row.result.qualified ? "text-bull" : "text-muted-foreground")}>
                        {trendLabel(row)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="num text-xs font-semibold">{row.result.momentum20d === null ? "N/A" : `${row.result.momentum20d > 0 ? "+" : ""}${row.result.momentum20d.toFixed(1)}%`}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="num text-xs font-semibold">{row.result.rsi?.toFixed(0) ?? "N/A"}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="num text-xs font-semibold">{row.result.rvol === null ? "N/A" : `${row.result.rvol.toFixed(2)}x`}</span>
                    </td>
                    <td className="px-4 py-3">
                      <ResilienceBadge row={row} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-muted-foreground">{row.sector}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <WatchlistButton symbol={row.symbol} variant="icon" />
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
                {sortedRows.length === 0 && status === "ready" ? (
                  <tr>
                    <td colSpan={12} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      No stocks match this view right now.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {selectedRow ? <DetailPanel row={selectedRow} /> : null}
        </>
      )}
    </section>
  );
}
