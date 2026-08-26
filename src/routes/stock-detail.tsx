import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, LineChart } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

import { AppShell } from "@/components/layout/AppShell";
import { WatchlistButton } from "@/components/watchlist/WatchlistButton";
import { loadRtt2xStockDetail, type Rtt2xLiveRow } from "@/lib/rtt2x-live-data";
import { friendlyRejectionReason, trendStructureLabel } from "@/lib/rtt2x-presentation";
import { calculateStandardEmas, getLatestEmaValues } from "@/lib/technical-analysis";
import { inr } from "@/lib/market-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/stock/$symbol")({
  component: StockDetailPage,
});

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

function useStockDetail(symbol: string) {
  const [row, setRow] = useState<Rtt2xLiveRow | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    loadRtt2xStockDetail(symbol).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setRow(result.row);
        setStatus("ready");
      } else {
        setErrorMessage(result.error);
        setStatus("error");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  return { row, status, errorMessage };
}

function StockDetailPage() {
  const navigate = useNavigate();
  const { symbol } = Route.useParams();
  const { row, status, errorMessage } = useStockDetail(symbol);

  const emaValues = useMemo(() => (row ? getLatestEmaValues(calculateStandardEmas(row.candles)) : null), [row]);
  const chartData = useMemo(
    () =>
      row && row.candles.length > 0
        ? row.candles.map((candle) => ({
            timestamp: candle.timestamp,
            close: candle.close,
            ema10: emaValues?.ema10,
            ema20: emaValues?.ema20,
            ema50: emaValues?.ema50,
            ema100: emaValues?.ema100,
            ema200: emaValues?.ema200,
          }))
        : [],
    [emaValues, row],
  );

  const chartSeries = [
    { key: "close", label: "Price", color: "var(--chart-price)" },
    { key: "ema10", label: "EMA10", color: "var(--chart-ema10)" },
    { key: "ema20", label: "EMA20", color: "var(--chart-ema20)" },
    { key: "ema50", label: "EMA50", color: "var(--chart-ema50)" },
    { key: "ema100", label: "EMA100", color: "var(--chart-ema100)" },
    { key: "ema200", label: "EMA200", color: "var(--chart-ema200)" },
  ] as const;

  if (status === "loading") {
    return (
      <AppShell title={symbol} subtitle="RTT 2.X stock analysis">
        <div className="panel p-6 text-sm text-muted-foreground">Loading real market data for {symbol}…</div>
      </AppShell>
    );
  }

  if (status === "error" || !row) {
    // User-facing message only — never the raw proxy/API error text (see errorMessage,
    // which may reference Upstox or HTTP status codes and is intentionally not shown).
    const isUnknownSymbol = errorMessage?.includes("not in the current screener universe") ?? false;
    return (
      <AppShell title={symbol} subtitle="RTT 2.X stock analysis">
        <div className="panel p-6 text-sm text-muted-foreground">
          {isUnknownSymbol
            ? "This stock isn't part of the current RTT screener universe."
            : "Live analysis is temporarily unavailable for this stock. Please try again."}
        </div>
      </AppShell>
    );
  }

  const r = row.result;
  const distanceFromEma20 = row.distanceFromEma20;
  const distanceFromEma50 = row.distanceFromEma50;

  return (
    <AppShell title={row.symbol} subtitle="RTT 2.X stock analysis">
      <div className="flex flex-col gap-4">
        <button
          onClick={() => navigate({ to: "/scanner" })}
          aria-label="Back to Scanner"
          className="inline-flex w-fit items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Scanner
        </button>

        <section className="panel overflow-hidden">
          <div className="grid gap-4 border-b border-border px-4 py-4 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Live NSE data · RTT 2.X</p>
              <h2 className="mt-2 text-2xl font-semibold">{row.companyName}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{row.symbol} · {row.sector}</p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <div className="rounded-lg border border-border bg-surface px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Current price</p>
                  <p className="num mt-1 text-lg font-semibold">{inr(row.currentPrice)}</p>
                </div>
                <div className="rounded-lg border border-border bg-surface px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">RTT 2.X Score</p>
                  <p className="num mt-1 text-lg font-semibold">{r.rttScore ?? "N/A"}/100</p>
                </div>
                <div className="rounded-lg border border-border bg-surface px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Classification</p>
                  <p className="mt-1 text-sm font-semibold">{r.classification ?? "N/A"}</p>
                </div>
                <WatchlistButton symbol={row.symbol} />
              </div>
            </div>
            <div className="rounded-lg border border-border bg-surface/80 p-4">
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">RTT status</p>
              <p className={cn("mt-2 text-sm font-semibold", r.qualified ? "text-bull" : "text-muted-foreground")}>
                {r.qualified ? "Qualified ✓" : "Not qualified"}
              </p>
              <p className="mt-3 text-xs text-muted-foreground">Trend structure</p>
              <p className="mt-1 text-sm">{trendStructureLabel(r)}</p>
              {!r.qualified ? (
                <p className="mt-3 text-xs text-muted-foreground">{friendlyRejectionReason(r.rejectionReason)}</p>
              ) : null}
              {r.sectorContext ? (
                <>
                  <p className="mt-3 text-xs text-muted-foreground">Sector context (informational only)</p>
                  <p className="mt-1 text-sm">
                    {r.sectorContext.sector} · rank {r.sectorContext.rank}/{r.sectorContext.totalSectors} · {r.sectorContext.performance20d > 0 ? "+" : ""}
                    {r.sectorContext.performance20d.toFixed(2)}% (20D)
                  </p>
                </>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="rounded-lg border border-border bg-surface/70 p-4">
              <div className="flex items-center gap-2">
                <LineChart className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Price & EMA trend</h3>
              </div>
              <div className="mt-4 h-72 w-full">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsLineChart data={chartData}>
                      <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
                      <XAxis dataKey="timestamp" tick={false} axisLine={false} />
                      <YAxis tick={{ fill: "var(--chart-tick)", fontSize: 11 }} axisLine={false} />
                      <Tooltip />
                      {chartSeries.map((series) => (
                        <Line key={series.key} type="monotone" dataKey={series.key} stroke={series.color} strokeWidth={1.2} dot={false} />
                      ))}
                    </RechartsLineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
                    Chart data unavailable
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-surface/70 p-4">
                <h3 className="text-sm font-semibold">EMA structure</h3>
                <div className="mt-3 space-y-2 text-sm">
                  {(
                    [
                      { label: "EMA10", value: emaValues?.ema10 ?? null },
                      { label: "EMA20", value: emaValues?.ema20 ?? null },
                      { label: "EMA50", value: emaValues?.ema50 ?? null },
                      { label: "EMA100", value: emaValues?.ema100 ?? null },
                      { label: "EMA200", value: emaValues?.ema200 ?? null },
                    ] as Array<{ label: string; value: number | null }>
                  ).map((item) => (
                    <div key={item.label} className="flex items-center justify-between rounded-md border border-border/60 bg-surface px-3 py-2">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="num font-medium">{item.value === null ? "N/A" : inr(item.value)}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">Status: {r.qualified ? "Qualified" : "Not qualified"}</p>
              </div>

              <div className="rounded-lg border border-border bg-surface/70 p-4">
                <h3 className="text-sm font-semibold">Technical status</h3>
                <div className="mt-3 space-y-2 text-sm">
                  {[
                    ["RSI14", r.rsi === null ? "N/A" : r.rsi.toFixed(1)],
                    ["20D Momentum", r.momentum20d === null ? "N/A" : `${r.momentum20d.toFixed(2)}%`],
                    ["RVOL", r.rvol === null ? "N/A" : `${r.rvol.toFixed(2)}x`],
                    ["Distance from EMA20", distanceFromEma20 === null ? "N/A" : `${distanceFromEma20 > 0 ? "+" : ""}${distanceFromEma20.toFixed(2)}%`],
                    ["Distance from EMA50", distanceFromEma50 === null ? "N/A" : `${distanceFromEma50 > 0 ? "+" : ""}${distanceFromEma50.toFixed(2)}%`],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between rounded-md border border-border/60 bg-surface px-3 py-2">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="num font-medium">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="panel overflow-hidden">
          <div className="border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold">RTT 2.X score breakdown</h3>
          </div>
          <div className="divide-y divide-border">
            {COMPONENT_ROWS.map((component) => {
              const value = r[component.key];
              if (typeof value !== "object" || value === null || !("score" in value)) return null;
              return (
                <div key={String(component.key)} className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                  <div>
                    <p className="text-sm font-medium">{component.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{component.explanation}</p>
                  </div>
                  <div className="text-sm font-semibold">{value.score === null ? "N/A" : `${value.score}/${value.maximum}`}</div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
