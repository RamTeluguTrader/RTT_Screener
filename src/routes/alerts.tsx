import { createFileRoute } from "@tanstack/react-router";
import { BellRing, CheckCircle2, PauseCircle, Trash2, RotateCcw } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Panel } from "@/components/ui-kit/Panel";
import { CreateAlertDialog } from "@/components/alerts/CreateAlertDialog";
import {
  useAlerts,
  describeAlert,
  formatValue,
  removeAlert,
  toggleAlert,
  rearmAlert,
  type Alert,
} from "@/lib/alerts-store";
import { stocks } from "@/lib/market-data";
import { cn } from "@/lib/utils";

const title = "Alerts — RTT Screener";
const description =
  "Create custom price, trend-score and AI-confidence alerts on any watchlist or scan result, with in-app delivery.";

export const Route = createFileRoute("/alerts")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: AlertsPage,
});

const time = (ts: number | null) =>
  ts ? new Date(ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—";

function AlertRow({ alert }: { alert: Alert }) {
  const fired = alert.status === "triggered";
  const paused = alert.status === "paused";
  const company = stocks.find((s) => s.symbol === alert.symbol)?.company;

  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3.5">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={cn(
            "grid h-8 w-8 shrink-0 place-items-center rounded-lg ring-1",
            fired
              ? "bg-bull/12 text-bull ring-bull/25"
              : paused
                ? "bg-surface-raised text-muted-foreground ring-border"
                : "bg-primary/12 text-primary ring-primary/25",
          )}
        >
          {fired ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : paused ? (
            <PauseCircle className="h-4 w-4" />
          ) : (
            <BellRing className="h-4 w-4" />
          )}
        </span>
        <div className="min-w-0">
          <p className="num truncate text-xs font-semibold">
            {alert.symbol}
            <span className="ml-2 font-sans text-[10px] font-normal text-muted-foreground">
              {company}
            </span>
          </p>
          <p className="truncate text-xs text-muted-foreground">{describeAlert(alert)}</p>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="rounded bg-surface-raised px-1.5 py-0.5 capitalize">
              {alert.source}
            </span>
            {alert.channels.toast && (
              <span className="rounded bg-surface-raised px-1.5 py-0.5">Toast</span>
            )}
            {alert.channels.feed && (
              <span className="rounded bg-surface-raised px-1.5 py-0.5">Feed</span>
            )}
            {alert.note && <span className="truncate">{alert.note}</span>}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <div className="text-right">
          <p
            className={cn(
              "text-[10px] font-semibold uppercase tracking-wider",
              fired ? "text-bull" : paused ? "text-muted-foreground" : "text-primary",
            )}
          >
            {alert.status}
          </p>
          <p className="num text-[10px] text-muted-foreground">
            {fired
              ? `${time(alert.triggeredAt)} · ${formatValue(alert.field, alert.triggeredValue ?? alert.value)}`
              : "Monitoring"}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => (fired ? rearmAlert(alert.id) : toggleAlert(alert.id))}
            aria-label={fired ? "Re-arm alert" : paused ? "Resume alert" : "Pause alert"}
            className="rounded-md border border-border bg-surface p-1.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            {fired ? <RotateCcw className="h-3.5 w-3.5" /> : <PauseCircle className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={() => removeAlert(alert.id)}
            aria-label="Delete alert"
            className="rounded-md border border-border bg-surface p-1.5 text-muted-foreground transition-colors hover:border-bear/40 hover:text-bear"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </li>
  );
}

function AlertsPage() {
  const alerts = useAlerts();
  const active = alerts.filter((a) => a.status !== "triggered");
  const triggered = alerts.filter((a) => a.status === "triggered");

  return (
    <AppShell title="Alerts" subtitle="Rule-based triggers monitored on every scanner refresh">
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            ["Armed", alerts.filter((a) => a.status === "armed").length],
            ["Triggered today", triggered.length],
            ["Paused", alerts.filter((a) => a.status === "paused").length],
          ].map(([label, count]) => (
            <div key={String(label)} className="panel p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {label}
              </p>
              <p className="num mt-2 text-2xl font-semibold">{count}</p>
            </div>
          ))}
        </div>

        <Panel
          title="Active rules"
          action={<CreateAlertDialog />}
          bodyClassName={active.length ? "px-4 py-1" : "p-6"}
        >
          {active.length ? (
            <ul className="divide-y divide-border">
              {active.map((a) => (
                <AlertRow key={a.id} alert={a} />
              ))}
            </ul>
          ) : (
            <div className="text-center">
              <p className="text-sm font-medium">No armed alerts</p>
              <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
                Create one from the scanner table, a watchlist card, or the New alert button above.
              </p>
            </div>
          )}
        </Panel>

        <Panel title="Trigger history" bodyClassName={triggered.length ? "px-4 py-1" : "p-6"}>
          {triggered.length ? (
            <ul className="divide-y divide-border">
              {triggered.map((a) => (
                <AlertRow key={a.id} alert={a} />
              ))}
            </ul>
          ) : (
            <p className="text-center text-xs text-muted-foreground">
              Nothing has fired yet in this session.
            </p>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
