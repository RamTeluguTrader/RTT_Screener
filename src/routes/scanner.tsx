import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { ScreenerTable, type SectionKey } from "@/components/dashboard/ScreenerTable";
import { Panel } from "@/components/ui-kit/Panel";

const title = "Scanner — RTT Screener";
const description = "Review RTT 2.X Top 10, Top 20, Emerging, and Recently Weakened over live NSE market data.";

const VALID_VIEWS: readonly SectionKey[] = ["top10", "top20", "emerging", "weakened"];

function isSectionKey(value: unknown): value is SectionKey {
  return typeof value === "string" && (VALID_VIEWS as readonly string[]).includes(value);
}

export const Route = createFileRoute("/scanner")({
  // Smallest clean tab-selection mechanism: an optional ?view= query param
  // (e.g. /scanner?view=top10). Absent/invalid values fall through to
  // ScreenerTable's own existing default ("top10") — generic /scanner
  // navigation is completely unaffected.
  validateSearch: (search: Record<string, unknown>): { view?: SectionKey } => ({
    view: isSectionKey(search.view) ? search.view : undefined,
  }),
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

const sections = [
  { name: "Top 10 — Best Setups", desc: "Highest RTT 2.X score across the qualified universe" },
  { name: "Top 20 — Watchlist", desc: "Extends Top 10 with the next-ranked qualified stocks" },
  { name: "Emerging", desc: "Developing trend-resilience structure, not yet Top 20" },
  { name: "Recently Weakened", desc: "Monitoring only — technical structure deteriorating" },
];

function ScannerPage() {
  const { view } = Route.useSearch();

  return (
    <AppShell title="Scanner" subtitle="RTT 2.X computed live from real Upstox NSE market data">
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {sections.map((s) => (
            <div key={s.name} className="panel p-4 text-left">
              <p className="truncate text-sm font-semibold">{s.name}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
        <ScreenerTable initialSection={view} />
        <Panel title="Scan log">
          <ul className="num flex flex-col gap-2 text-xs text-muted-foreground">
            <li>Live NSE candles fetched from Upstox</li>
            <li>RTT 2.X recomputed over the current candle history</li>
            <li>Qualified rows ranked by RTT 2.X score; sector plays no part in ranking</li>
          </ul>
        </Panel>
      </div>
    </AppShell>
  );
}
