import { describe, expect, it } from "vitest";

import { DEVELOPMENT_MARKET_STOCKS } from "../src/lib/dev-market-data";
import { buildRttDashboardData } from "../src/lib/rtt-dashboard-data";

describe("RTT dashboard data layer", () => {
  it("processes development data through RTT and retains only qualified stocks", () => {
    const data = buildRttDashboardData();

    expect(data.totalStocks).toBe(DEVELOPMENT_MARKET_STOCKS.length);
    expect(data.qualifiedRows.length).toBeGreaterThan(0);
    expect(data.rejectedRows.length).toBeGreaterThan(0);
    expect(data.qualifiedRows.every((row) => row.qualified)).toBe(true);
    expect(data.qualifiedRows.every((row) => row.rttScore !== null)).toBe(true);
    expect(data.qualifiedRows.every((row) => row.rttScore !== undefined)).toBe(true);
  });

  it("sorts qualified results by RTT score descending and keeps top limits deterministic", () => {
    const top10 = buildRttDashboardData(10);
    const top20 = buildRttDashboardData(20);

    expect(top10.qualifiedRows.length).toBeLessThanOrEqual(10);
    expect(top20.qualifiedRows.length).toBeLessThanOrEqual(20);

    const sorted = [...top20.qualifiedRows].sort((left, right) => {
      if (right.rttScore !== left.rttScore) return (right.rttScore ?? -1) - (left.rttScore ?? -1);
      return left.symbol.localeCompare(right.symbol);
    });

    expect(top20.qualifiedRows).toEqual(sorted);
  });

  it("maps RTT classifications and component breakdowns from the engine results", () => {
    const data = buildRttDashboardData(5);
    const first = data.qualifiedRows[0]!;

    expect(first.classification).toBeDefined();
    expect(first.componentScores.some((score) => score.score !== null)).toBe(true);
    expect(first.componentScores[0]?.label).toBe("Momentum");
    expect(first.componentScores[0]?.maximum).toBeGreaterThan(0);
    expect(first.componentScores[0]?.score).toBeGreaterThanOrEqual(0);
  });

  it("does not expose EMA Stack Quality in the dashboard score breakdown", () => {
    const data = buildRttDashboardData(5);
    const first = data.qualifiedRows[0]!;

    expect(first.componentScores.some((score) => score.label === "EMA Stack Quality")).toBe(false);
  });

  it("does not expose proprietary scoring thresholds in the presentation layer", () => {
    const data = buildRttDashboardData(3);
    const first = data.qualifiedRows[0]!;

    expect(first.componentScores.some((score) => score.label.includes("threshold"))).toBe(false);
    expect(first.componentScores.some((score) => score.label.includes("formula"))).toBe(false);
    expect(first.componentScores.some((score) => score.label.includes("config"))).toBe(false);
  });
});
