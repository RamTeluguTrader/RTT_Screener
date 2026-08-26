import { Link } from "@tanstack/react-router";

import { WatchlistButton } from "./WatchlistButton";
import type { WatchlistEntry } from "@/hooks/use-watchlist-data";
import { describeScoreChange, describeTrendStructureChange, formatScoreDelta, trendStructureLabel } from "@/lib/rtt2x-presentation";
import { inr } from "@/lib/market-data";
import { cn } from "@/lib/utils";

function formatDate(timestampMs: number | undefined): string {
  if (!timestampMs) return "N/A";
  return new Date(timestampMs).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function Field({ label, value, tone }: { label: string; value: string; tone?: "bull" | "bear" }) {
  return (
    <div className="rounded-md border border-border/60 bg-surface px-2.5 py-1.5">
      <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
      <p className={cn("num mt-0.5 text-xs font-semibold", tone === "bull" && "text-bull", tone === "bear" && "text-bear")}>{value}</p>
    </div>
  );
}

export function WatchlistCard({ entry }: { entry: WatchlistEntry }) {
  if (entry.status === "loading") {
    return (
      <div className="panel p-4">
        <p className="num text-sm font-semibold">{entry.symbol}</p>
        <p className="mt-2 text-xs text-muted-foreground">Loading current analysis…</p>
      </div>
    );
  }

  if (entry.status === "error" || !entry.row) {
    return (
      <div className="panel p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="num text-sm font-semibold">{entry.symbol}</p>
          <WatchlistButton symbol={entry.symbol} />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Live data temporarily unavailable</p>
      </div>
    );
  }

  const { row, previousSnapshot } = entry;
  const r = row.result;
  const scoreChangeText = describeScoreChange(r.rttScore, previousSnapshot);
  const trendChangeText = describeTrendStructureChange(r, previousSnapshot);
  const scoreDelta = formatScoreDelta(r.rttScore, previousSnapshot);
  const deltaTone = scoreDelta ? (scoreDelta.startsWith("+") ? "bull" : scoreDelta.startsWith("-") ? "bear" : undefined) : undefined;
  const latestCandleTimestamp = row.candles.at(-1)?.timestamp;

  return (
    <div className="panel p-4">
      <div className="flex items-start justify-between gap-2">
        <Link to="/stock/$symbol" params={{ symbol: row.symbol }} className="min-w-0 hover:opacity-80">
          <p className="num truncate text-sm font-semibold">{row.symbol}</p>
          <p className="truncate text-xs text-muted-foreground">{row.companyName}</p>
          <p className="truncate text-[10px] text-muted-foreground">{row.sector}</p>
        </Link>
        <WatchlistButton symbol={row.symbol} />
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="num text-lg font-semibold">{inr(row.currentPrice)}</span>
        <span className="text-xs font-medium text-muted-foreground">{trendStructureLabel(r)}</span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        <Field label="RTT Score" value={r.rttScore !== null ? r.rttScore.toFixed(1) : "N/A"} />
        <Field label="Previous" value={previousSnapshot ? previousSnapshot.score.toFixed(1) : "—"} />
        <Field label="Change" value={scoreDelta ?? "—"} tone={deltaTone} />
        <Field label="RSI" value={r.rsi !== null ? r.rsi.toFixed(0) : "N/A"} />
        <Field label="20 EMA Resilience" value={`${r.ema20ResilienceScore.score ?? "N/A"}/${r.ema20ResilienceScore.maximum}`} />
        <Field label="50 EMA Resilience" value={`${r.ema50ResilienceScore.score ?? "N/A"}/${r.ema50ResilienceScore.maximum}`} />
        <Field label="20D Momentum" value={r.momentum20d !== null ? `${r.momentum20d > 0 ? "+" : ""}${r.momentum20d.toFixed(1)}%` : "N/A"} />
        <Field label="Last updated" value={formatDate(latestCandleTimestamp)} />
      </div>

      <div className="mt-3 rounded-lg border border-border/60 bg-surface/70 px-3 py-2">
        <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">What changed</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {scoreChangeText}
          {trendChangeText ? ` ${trendChangeText}` : ""}
        </p>
      </div>
    </div>
  );
}
