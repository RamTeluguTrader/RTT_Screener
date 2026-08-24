import { describe, expect, it } from "vitest";

import type { DevelopmentMarketStock } from "../src/lib/dev-market-data";
import { buildStockDetailViewModel, buildStockDetailViewModelFromStock } from "../src/lib/rtt-stock-detail";
import { buildRttDashboardData } from "../src/lib/rtt-dashboard-data";
import { describeAlert, createAlert, removeAlert, hydrateAlerts } from "../src/lib/alerts-store";

describe("scope cleanup", () => {
  it("keeps stock detail and RTT scoring available", () => {
    const detail = buildStockDetailViewModel("HAL");

    expect(detail).not.toBeNull();
    expect(detail?.rttScore).not.toBeNull();
    expect(detail?.componentScores.length).toBe(6);
  });

  it("keeps the dashboard data layer and RTT qualification flow intact", () => {
    const data = buildRttDashboardData(5);

    expect(data.totalStocks).toBe(60);
    expect(data.qualifiedRows.length).toBeGreaterThan(0);
    expect(data.qualifiedRows.every((row) => row.qualified)).toBe(true);
  });

  it("handles missing stock data without throwing", () => {
    const partialStock: DevelopmentMarketStock = {
      symbol: "TESTPARTIAL",
      displaySymbol: "TESTPARTIAL",
      companyName: "Test Partial",
      sector: "Testing",
      scenario: "WEAK",
      currentPrice: Number.NaN,
      high52Week: Number.NaN,
      rsi14: Number.NaN,
      volume: 0,
      averageVolume20d: 0,
      emaValues: {
        ema10: null,
        ema20: null,
        ema50: null,
        ema100: null,
        ema200: null,
      },
      candles: [],
    };

    const detail = buildStockDetailViewModelFromStock(partialStock);

    expect(detail).not.toBeNull();
    expect(detail?.currentPrice).toBeNull();
    expect(detail?.candles).toEqual([]);
    expect(detail?.componentScores.some((component) => component.score === null)).toBe(true);
  });

  it("returns a controlled not-found state for an unknown symbol", () => {
    const detail = buildStockDetailViewModel("UNKNOWN_STOCK");

    expect(detail).toBeNull();
  });

  it("keeps technical alerts informational and avoids recommendation wording", () => {
    hydrateAlerts();
    const alert = createAlert({
      symbol: "HAL",
      field: "trendScore",
      operator: "above",
      value: 80,
      note: "Technical condition threshold",
      channels: { toast: true, feed: false },
      source: "scanner",
    });

    expect(describeAlert(alert)).toContain("Trend score");
    expect(describeAlert(alert)).not.toContain("buy");
    expect(describeAlert(alert)).not.toContain("sell");

    removeAlert(alert.id);
  });
});
