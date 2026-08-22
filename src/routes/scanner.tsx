import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { ScreenerTable } from "@/components/dashboard/ScreenerTable";
import { Panel } from "@/components/ui-kit/Panel";

const title = "Scanner — RTT Screener";
const description =
  "Configure EMA stack, breakout and momentum filters, then review a development-only RTT dataset.";

export const Route = createFileRoute("/scanner")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: ScannerPage,
});

const presets = [
  { name: "RTT Core Stack", desc: "10 > 20 > 50 > 100 > 200 with rising slope", hits: 214 },
  { name: "Breakout Thrust", desc: "20-day high + 1.8x average volume", hits: 37 },
  { name: "Pullback Structure", desc: "Retest of 20 EMA inside an uptrend", hits: 62 },
  { name: "200 EMA Reclaim", desc: "First close above 200 EMA in 40 sessions", hits: 18 },
];

function ScannerPage() {
  return (
    <AppShell title="Scanner" subtitle="Review a development-only RTT dataset with synthetic market-history inputs">
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {presets.map((p) => (
            <div
              key={p.name}
              className="panel p-4 text-left"
            >
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                <p className="truncate text-sm font-semibold">{p.name}</p>
                <span className="num rounded-md bg-primary/12 px-1.5 py-0.5 text-[10px] font-semibold text-primary ring-1 ring-primary/25">
                  {p.hits}
                </span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{p.desc}</p>
            </div>
          ))}
        </div>
        <ScreenerTable />
        <Panel title="Scan log">
          <ul className="num flex flex-col gap-2 text-xs text-muted-foreground">
            <li>Development dataset loaded — 60 synthetic symbols</li>
            <li>EMA model v4.2 recomputed over local candle history</li>
            <li>Qualified RTT rows ranked for the current development view</li>
          </ul>
        </Panel>
      </div>
    </AppShell>
  );
}
