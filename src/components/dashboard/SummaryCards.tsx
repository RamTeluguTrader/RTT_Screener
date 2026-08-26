import { useMemo } from "react";
import { Activity, ScanLine, Layers, TrendingUp, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRtt2xUniverse } from "@/hooks/use-rtt2x-universe";
import { rankByRttScore } from "@/lib/rtt2x-screener";

function Card({
  label,
  value,
  meta,
  icon: Icon,
  accent,
  children,
}: {
  label: string;
  value: string;
  meta: string;
  icon: React.ElementType;
  accent?: "primary" | "bull" | "warn" | "info";
  children?: React.ReactNode;
}) {
  const tone = {
    primary: "text-primary bg-primary/12 ring-primary/25",
    bull: "text-bull bg-bull/12 ring-bull/25",
    warn: "text-warn bg-warn/12 ring-warn/25",
    info: "text-info bg-info/12 ring-info/25",
  }[accent ?? "primary"];

  return (
    <div className="panel p-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <p className="truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </p>
        <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg ring-1", tone)}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="num mt-3 text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 truncate text-xs text-muted-foreground">{meta}</p>
      {children}
    </div>
  );
}

export function SummaryCards() {
  const { rows, status } = useRtt2xUniverse();
  const ranked = useMemo(() => rankByRttScore(rows), [rows]);
  const strongSetups = ranked.filter((row) => (row.result.rttScore ?? 0) >= 70).length;
  const loading = status === "loading";

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <Card
        label="Data source"
        value="Live NSE"
        meta="RTT 2.X over real Upstox market data"
        icon={Activity}
        accent="bull"
      >
        <div className="mt-3 flex items-center gap-2 text-xs">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-bull/70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-bull" />
          </span>
          <span className="text-muted-foreground">{loading ? "Loading…" : "Live"}</span>
        </div>
      </Card>
      <Card
        label="Stocks scanned"
        value={String(rows.length)}
        meta="Real NSE screener universe"
        icon={ScanLine}
        accent="info"
      />
      <Card
        label="RTT Candidates"
        value={String(ranked.length)}
        meta="Stocks matching the RTT setup"
        icon={Layers}
        accent="primary"
      />
      <Card
        label="Top 20 RTT"
        value={String(Math.min(ranked.length, 20))}
        meta="Ranked by RTT 2.X score"
        icon={TrendingUp}
        accent="warn"
      />
      <Card
        label="Strong setups"
        value={String(strongSetups)}
        meta="70+ RTT 2.X quality"
        icon={Sparkles}
        accent="primary"
      />
    </div>
  );
}
