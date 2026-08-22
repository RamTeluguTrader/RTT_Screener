import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { Panel } from "@/components/ui-kit/Panel";
import { Switch } from "@/components/ui/switch";

const title = "Settings — RTT Screener";
const description =
  "Adjust development-view preferences for the RTT screener demo.";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: SettingsPage,
});

const toggles = [
  { label: "Intraday rescan every 15 minutes", desc: "Recompute EMA posture on each candle close", on: true },
  { label: "RTT ranking", desc: "Score candidates with the technical confidence model", on: true },
  { label: "Push alerts to mobile", desc: "Deliver triggers to the RTT mobile app", on: true },
  { label: "Include SME segment", desc: "Add SME-listed instruments to the universe", on: false },
];

function SettingsPage() {
  return (
    <AppShell title="Settings" subtitle="Desk configuration for the development RTT review">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="Scanner preferences">
          <ul className="flex flex-col gap-4">
            {toggles.map((t) => (
              <li key={t.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-medium">{t.label}</p>
                  <p className="text-[11px] text-muted-foreground">{t.desc}</p>
                </div>
                <Switch defaultChecked={t.on} />
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Account">
          <dl className="flex flex-col gap-3 text-xs">
            {[
              ["Name", "Rohan Kulkarni"],
              ["Email", "rohan@rttdesk.in"],
              ["Broker link", "Zerodha Kite · connected"],
              ["Plan", "Development review mode"],
            ].map(([k, v]) => (
              <div
                key={k}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5"
              >
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="truncate font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      </div>
    </AppShell>
  );
}
