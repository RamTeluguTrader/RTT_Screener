import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, LineChart } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { buildStockDetailViewModel } from "@/lib/rtt-stock-detail";
import { inr } from "@/lib/market-data";
import { formatScoreWithMaximum } from "@/lib/score-display";
import { calculateStandardEmas, getLatestEmaValues } from "@/lib/technical-analysis";
import { useMemo } from "react";
import { ResponsiveContainer, LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

export const Route = createFileRoute("/stock/$symbol")({
  component: StockDetailPage,
});

function StockDetailPage() {
  const navigate = useNavigate();
  const { symbol } = Route.useParams();
  const viewModel = useMemo(() => buildStockDetailViewModel(symbol), [symbol]);
  const emaValues = useMemo(() => viewModel ? getLatestEmaValues(calculateStandardEmas(viewModel.candles)) : null, [viewModel]);
  const chartData = useMemo(() => viewModel && viewModel.candles.length > 0 ? viewModel.candles.map((candle) => ({
    timestamp: candle.timestamp,
    close: candle.close,
    ema10: emaValues?.ema10,
    ema20: emaValues?.ema20,
    ema50: emaValues?.ema50,
    ema100: emaValues?.ema100,
    ema200: emaValues?.ema200,
  })) : [], [emaValues, viewModel]);

  const chartSeries = [
    { key: "close", label: "Price", color: "var(--chart-price)" },
    { key: "ema10", label: "EMA10", color: "var(--chart-ema10)" },
    { key: "ema20", label: "EMA20", color: "var(--chart-ema20)" },
    { key: "ema50", label: "EMA50", color: "var(--chart-ema50)" },
    { key: "ema100", label: "EMA100", color: "var(--chart-ema100)" },
    { key: "ema200", label: "EMA200", color: "var(--chart-ema200)" },
  ] as const;

  if (!viewModel) {
    return (
      <AppShell title="Stock detail" subtitle="Selected RTT candidate">
        <div className="panel p-6 text-sm text-muted-foreground">No stock detail available for this symbol.</div>
      </AppShell>
    );
  }

  return (
    <AppShell title={viewModel.displaySymbol} subtitle="RTT candidate detail">
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
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Development Data</p>
              <h2 className="mt-2 text-2xl font-semibold">{viewModel.companyName}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{viewModel.displaySymbol} · {viewModel.sector}</p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <div className="rounded-lg border border-border bg-surface px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Current price</p>
                  <p className="num mt-1 text-lg font-semibold">{inr(viewModel.currentPrice)}</p>
                </div>
                <div className="rounded-lg border border-border bg-surface px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">RTT Score</p>
                  <p className="num mt-1 text-lg font-semibold">{formatScoreWithMaximum(viewModel.rttScore, 100)}</p>
                </div>
                <div className="rounded-lg border border-border bg-surface px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Classification</p>
                  <p className="mt-1 text-sm font-semibold">{viewModel.classification ?? "N/A"}</p>
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-border bg-surface/80 p-4">
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">RTT qualification</p>
              <p className="mt-2 text-sm font-semibold">{viewModel.qualified ? "RTT Qualified ✓" : "Not qualified"}</p>
              <p className="mt-3 text-xs text-muted-foreground">EMA Structure</p>
              <p className="mt-1 text-sm">10 &gt; 20 &gt; 50 &gt; 100 &gt; 200</p>
              <p className="mt-3 text-xs text-muted-foreground">RSI14</p>
              <p className="mt-1 text-sm">{viewModel.rsi14?.toFixed(1) ?? "N/A"}</p>
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
                  {([
                    { label: "EMA10", value: viewModel.ema10 },
                    { label: "EMA20", value: viewModel.ema20 },
                    { label: "EMA50", value: viewModel.ema50 },
                    { label: "EMA100", value: viewModel.ema100 },
                    { label: "EMA200", value: viewModel.ema200 },
                  ] as Array<{ label: string; value: number | null }>).map((row) => (
                    <div key={row.label} className="flex items-center justify-between rounded-md border border-border/60 bg-surface px-3 py-2">
                      <span className="text-muted-foreground">{row.label}</span>
                      <span className="num font-medium">{row.value === null ? "N/A" : inr(row.value)}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">Aligned: {viewModel.emaAligned ? "Yes" : "No"}</p>
              </div>

              <div className="rounded-lg border border-border bg-surface/70 p-4">
                <h3 className="text-sm font-semibold">Technical status</h3>
                <div className="mt-3 space-y-2 text-sm">
                  {[
                    ["Momentum", viewModel.momentum20d === null ? "N/A" : `${viewModel.momentum20d.toFixed(2)}%`],
                    ["RVOL", viewModel.rvol === null ? "N/A" : viewModel.rvol.toFixed(2)],
                    ["52W High", viewModel.high52Week === null ? "N/A" : inr(viewModel.high52Week)],
                    ["Distance from 52W High", viewModel.distanceFrom52WeekHigh === null ? "N/A" : `${viewModel.distanceFrom52WeekHigh.toFixed(2)}%`],
                    ["Extension from EMA20", viewModel.extensionFromEma20 === null ? "N/A" : `${viewModel.extensionFromEma20.toFixed(2)}%`],
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
            <h3 className="text-sm font-semibold">RTT score breakdown</h3>
          </div>
          <div className="divide-y divide-border">
            {viewModel.componentScores.map((component) => (
              <div key={component.label} className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                <div>
                  <p className="text-sm font-medium">{component.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{component.explanation}</p>
                </div>
                <div className="text-sm font-semibold">
                  {component.score === null ? "N/A" : `${component.score}/${component.maximum}`}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
