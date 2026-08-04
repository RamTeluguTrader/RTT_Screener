import { Activity, ScanLine, Layers, TrendingUp, Sparkles } from "lucide-react";
import { summary } from "@/lib/market-data";
import { cn } from "@/lib/utils";

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
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <Card
        label="Market status"
        value="Open"
        meta={summary.marketStatus.session}
        icon={Activity}
        accent="bull"
      >
        <div className="mt-3 flex items-center gap-2 text-xs">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-bull/70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-bull" />
          </span>
          <span className="num text-muted-foreground">
            NIFTY 50 {summary.marketStatus.nifty.toLocaleString("en-IN")}
          </span>
          <span className="num font-semibold text-bull">+{summary.marketStatus.niftyPct}%</span>
        </div>
      </Card>
      <Card
        label="Stocks scanned"
        value={summary.scanned.toLocaleString("en-IN")}
        meta="Full NSE universe · 15m candles"
        icon={ScanLine}
        accent="info"
      />
      <Card
        label="EMA qualified"
        value={String(summary.emaQualified)}
        meta="10 > 20 > 50 > 100 > 200 stack"
        icon={Layers}
        accent="primary"
      />
      <Card
        label="New breakouts"
        value={String(summary.breakouts)}
        meta="20-day high with volume thrust"
        icon={TrendingUp}
        accent="warn"
      />
      <Card
        label="AI signals"
        value={String(summary.aiSignals)}
        meta="Confidence above 80%"
        icon={Sparkles}
        accent="primary"
      />
    </div>
  );
}
