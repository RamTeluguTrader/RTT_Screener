import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { Panel, Delta } from "@/components/ui-kit/Panel";
import { positions, inr } from "@/lib/market-data";

const title = "Portfolio — RTT Screener";
const description =
  "Open swing positions with live mark-to-market P&L, exposure weights and allocation health.";

export const Route = createFileRoute("/portfolio")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: PortfolioPage,
});

function PortfolioPage() {
  const rows = positions.map((p) => {
    const invested = p.qty * p.avg;
    const value = p.qty * p.ltp;
    return { ...p, invested, value, pnl: value - invested, pnlPct: ((value - invested) / invested) * 100 };
  });
  const invested = rows.reduce((a, r) => a + r.invested, 0);
  const value = rows.reduce((a, r) => a + r.value, 0);
  const pnl = value - invested;

  return (
    <AppShell title="Portfolio" subtitle="Mark-to-market across all open swing positions">
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            ["Invested", inr(invested)],
            ["Current value", inr(value)],
            ["Unrealised P&L", inr(pnl)],
          ].map(([label, v], i) => (
            <div key={label} className="panel p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {label}
              </p>
              <p
                className={`num mt-2 text-2xl font-semibold ${i === 2 ? (pnl >= 0 ? "text-bull" : "text-bear") : ""}`}
              >
                {v}
              </p>
              {i === 2 && <Delta value={(pnl / invested) * 100} className="mt-1 block" />}
            </div>
          ))}
        </div>

        <Panel title="Open positions" bodyClassName="p-0">
          <div className="scroll-slim overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  <th className="px-4 py-2.5 font-semibold">Stock</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Qty</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Avg cost</th>
                  <th className="px-4 py-2.5 text-right font-semibold">LTP</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Value</th>
                  <th className="px-4 py-2.5 text-right font-semibold">P&L</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.symbol} className="border-b border-border/60 last:border-0">
                    <td className="num px-4 py-3 text-xs font-semibold">{r.symbol}</td>
                    <td className="num px-4 py-3 text-right text-xs">{r.qty}</td>
                    <td className="num px-4 py-3 text-right text-xs">{inr(r.avg)}</td>
                    <td className="num px-4 py-3 text-right text-xs">{inr(r.ltp)}</td>
                    <td className="num px-4 py-3 text-right text-xs">{inr(r.value)}</td>
                    <td className="px-4 py-3 text-right">
                      <p
                        className={`num text-xs font-semibold ${r.pnl >= 0 ? "text-bull" : "text-bear"}`}
                      >
                        {inr(r.pnl)}
                      </p>
                      <Delta value={r.pnlPct} className="text-[10px]" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
