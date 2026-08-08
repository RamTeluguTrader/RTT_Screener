import { useMemo } from "react";
import { Activity, ScanLine, Layers, TrendingUp, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildRttDashboardData } from "@/lib/rtt-dashboard-data";

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
  const dashboardData = useMemo(() => buildRttDashboardData(20), []);
  const strongSetups = dashboardData.qualifiedRows.filter((row) => (row.rttScore ?? 0) >= 80).length;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <Card
        label="Development data"
        value="Synthetic"
        meta="RTT engine over mock market history"
        icon={Activity}
        accent="bull"
      >
        <div className="mt-3 flex items-center gap-2 text-xs">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-bull/70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-bull" />
          </span>
          <span className="text-muted-foreground">Development-only visibility</span>
        </div>
      </Card>
      <Card
        label="Stocks scanned"
        value={dashboardData.totalStocks.toLocaleString("en-IN")}
        meta="Synthetic NSE-style universe"
        icon={ScanLine}
        accent="info"
      />
      <Card
        label="RTT qualified"
        value={String(dashboardData.qualifiedRows.length)}
        meta="EMA + RSI qualification gate"
        icon={Layers}
        accent="primary"
      />
      <Card
        label="Top 20 RTT"
        value={String(Math.min(dashboardData.qualifiedRows.length, 20))}
        meta="Ranked by RTT score"
        icon={TrendingUp}
        accent="warn"
      />
      <Card
        label="Strong setups"
        value={String(strongSetups)}
        meta="80+ RTT quality"
        icon={Sparkles}
        accent="primary"
      />
    </div>
  );
}
