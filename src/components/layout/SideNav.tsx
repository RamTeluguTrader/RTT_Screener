import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Radar,
  Star,
  Briefcase,
  BellRing,
  Settings,
  Activity,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { label: "Dashboard", to: "/", icon: LayoutDashboard },
  { label: "Scanner", to: "/scanner", icon: Radar },
  { label: "Watchlist", to: "/watchlist", icon: Star },
  { label: "Portfolio", to: "/portfolio", icon: Briefcase },
  { label: "Alerts", to: "/alerts", icon: BellRing },
  { label: "Settings", to: "/settings", icon: Settings },
] as const;

export function SideNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  return (
    <nav className="flex h-full flex-col gap-1 bg-sidebar px-3 py-5">
      <div className="mb-6 flex items-center justify-between gap-2 px-2">
        <Link to="/" onClick={onNavigate} className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/30">
            <Activity className="h-4.5 w-4.5" />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-display text-sm font-semibold tracking-tight">
              RTT Screener
            </span>
            <span className="block truncate text-[11px] text-muted-foreground">
              Swing desk · Live NSE data
            </span>
          </span>
        </Link>
        {onNavigate && (
          <button
            onClick={onNavigate}
            aria-label="Close navigation"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Terminal
      </p>

      {nav.map((item) => {
        const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
            )}
          >
            <item.icon
              className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "text-muted-foreground")}
            />
            <span className="truncate">{item.label}</span>
            {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
          </Link>
        );
      })}

      <div className="mt-auto rounded-xl border border-border bg-surface p-3.5">
        <p className="text-xs font-semibold">Scanner engine</p>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          RTT 2.X · live Upstox NSE data
        </p>
      </div>
    </nav>
  );
}
