import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, Search, Bell, ChevronDown } from "lucide-react";
import { SideNav } from "./SideNav";
import { useAlerts } from "@/lib/alerts-store";

export function AppShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const triggered = useAlerts().filter((a) => a.status === "triggered").length;


  return (
    <div className="min-h-screen w-full bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] border-r border-sidebar-border lg:block">
        <SideNav />
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[264px] border-r border-sidebar-border shadow-2xl">
            <SideNav onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-xl">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button
                onClick={() => setOpen(true)}
                aria-label="Open navigation"
                className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-accent lg:hidden"
              >
                <Menu className="h-4 w-4" />
              </button>
              <div className="min-w-0">
                <h1 className="truncate text-base font-semibold sm:text-lg">{title}</h1>
                <p className="hidden truncate text-xs text-muted-foreground sm:block">{subtitle}</p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <div className="hidden items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 xl:flex">
                <Search className="h-3.5 w-3.5 text-muted-foreground" />
                <input
                  placeholder="Search symbol, sector, setup"
                  className="w-56 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                />
                <kbd className="num rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  /
                </kbd>
              </div>
              <Link
                to="/alerts"
                aria-label={`Alerts, ${triggered} triggered`}
                className="relative rounded-lg border border-border bg-surface p-2 text-muted-foreground transition-colors hover:text-foreground"
              >
                <Bell className="h-4 w-4" />
                {triggered > 0 && (
                  <span className="num absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-bear px-1 text-[9px] font-semibold text-background">
                    {triggered}
                  </span>
                )}
              </Link>

              <button className="flex items-center gap-2 rounded-lg border border-border bg-surface py-1.5 pl-1.5 pr-2.5 transition-colors hover:bg-accent">
                <span className="num grid h-7 w-7 place-items-center rounded-md bg-primary/15 text-[11px] font-semibold text-primary">
                  RK
                </span>
                <span className="hidden text-left sm:block">
                  <span className="block text-xs font-medium leading-tight">Rohan Kulkarni</span>
                  <span className="block text-[10px] leading-tight text-muted-foreground">
                    Pro desk
                  </span>
                </span>
                <ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground sm:block" />
              </button>
            </div>
          </div>
        </header>

        <main className="px-4 py-5 sm:px-6 sm:py-6">{children}</main>
      </div>
    </div>
  );
}
