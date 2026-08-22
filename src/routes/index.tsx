import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { ScreenerTable } from "@/components/dashboard/ScreenerTable";
import { MarketRail } from "@/components/dashboard/MarketRail";
import { BottomPanels } from "@/components/dashboard/BottomPanels";

const title = "RTT Screener — EMA Trend Dashboard for Swing Traders";
const description =
  "Development-only RTT dashboard for reviewing synthetic market data and score breakdowns.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  return (
    <AppShell title="Dashboard" subtitle="Development RTT review across a synthetic market dataset">
      <div className="flex flex-col gap-4">
        <SummaryCards />
        <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,1fr)_340px]">
          <ScreenerTable />
          <MarketRail />
        </div>
        <BottomPanels />
      </div>
    </AppShell>
  );
}
