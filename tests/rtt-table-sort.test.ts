import { describe, expect, it } from "vitest";

import type { RttDashboardRow } from "../src/lib/rtt-dashboard-data";
import { DEFAULT_SORT, nextSortState, sortDashboardRows, type SortState } from "../src/lib/rtt-table-sort";

function row(overrides: Partial<RttDashboardRow>): RttDashboardRow {
  const symbol = overrides.symbol ?? "AAA";
  return {
    symbol,
    displaySymbol: symbol,
    companyName: "AAA Co",
    sector: "Test",
    currentPrice: 100,
    rsi: 60,
    rttScore: 70,
    classification: "Good",
    qualified: true,
    emaStatus: "Aligned",
    momentum: 5,
    volume: 1.5,
    componentScores: [],
    qualitativeSignals: [],
    rank: 1,
    ...overrides,
  };
}

const rows: RttDashboardRow[] = [
  row({ symbol: "BBB", currentPrice: 200, rsi: 55, rttScore: 90, classification: "Exceptional", rank: 1 }),
  row({ symbol: "AAA", currentPrice: 150, rsi: 70, rttScore: 90, classification: "Exceptional", rank: 2 }),
  row({ symbol: "CCC", currentPrice: 100, rsi: 65, rttScore: 75, classification: "Good", rank: 3 }),
  row({ symbol: "DDD", currentPrice: 300, rsi: 50, rttScore: 60, classification: "Watch", rank: 4 }),
];

function symbolsOf(sorted: RttDashboardRow[]): string[] {
  return sorted.map((r) => r.symbol);
}

describe("RTT screener table sorting", () => {
  it("defaults to RTT Score descending", () => {
    expect(DEFAULT_SORT).toEqual({ column: "rttScore", direction: "desc" });
    expect(symbolsOf(sortDashboardRows(rows, DEFAULT_SORT))).toEqual(["AAA", "BBB", "CCC", "DDD"]);
  });

  it("sorts by Symbol ascending then descending", () => {
    const asc: SortState = nextSortState(DEFAULT_SORT, "symbol");
    expect(asc).toEqual({ column: "symbol", direction: "asc" });
    expect(symbolsOf(sortDashboardRows(rows, asc))).toEqual(["AAA", "BBB", "CCC", "DDD"]);

    const desc = nextSortState(asc, "symbol");
    expect(desc).toEqual({ column: "symbol", direction: "desc" });
    expect(symbolsOf(sortDashboardRows(rows, desc))).toEqual(["DDD", "CCC", "BBB", "AAA"]);
  });

  it("sorts by Price", () => {
    const desc = nextSortState(DEFAULT_SORT, "price");
    expect(desc.direction).toBe("desc");
    expect(symbolsOf(sortDashboardRows(rows, desc))).toEqual(["DDD", "BBB", "AAA", "CCC"]);

    const asc = nextSortState(desc, "price");
    expect(symbolsOf(sortDashboardRows(rows, asc))).toEqual(["CCC", "AAA", "BBB", "DDD"]);
  });

  it("sorts by RSI", () => {
    const desc = nextSortState(DEFAULT_SORT, "rsi");
    expect(desc.direction).toBe("desc");
    expect(symbolsOf(sortDashboardRows(rows, desc))).toEqual(["AAA", "CCC", "BBB", "DDD"]);

    const asc = nextSortState(desc, "rsi");
    expect(symbolsOf(sortDashboardRows(rows, asc))).toEqual(["DDD", "BBB", "CCC", "AAA"]);
  });

  it("sorts by RTT Score and toggles direction on the same column", () => {
    const stillDesc = sortDashboardRows(rows, DEFAULT_SORT);
    expect(symbolsOf(stillDesc)).toEqual(["AAA", "BBB", "CCC", "DDD"]);

    const asc = nextSortState(DEFAULT_SORT, "rttScore");
    expect(asc).toEqual({ column: "rttScore", direction: "asc" });
    expect(symbolsOf(sortDashboardRows(rows, asc))).toEqual(["DDD", "CCC", "AAA", "BBB"]);
  });

  it("sorts by Classification using RTT quality tiers, not alphabetical order", () => {
    const desc = nextSortState(DEFAULT_SORT, "classification");
    expect(desc.direction).toBe("desc");
    expect(symbolsOf(sortDashboardRows(rows, desc))).toEqual(["AAA", "BBB", "CCC", "DDD"]);

    const asc = nextSortState(desc, "classification");
    expect(symbolsOf(sortDashboardRows(rows, asc))).toEqual(["DDD", "CCC", "AAA", "BBB"]);
  });

  it("toggles ascending/descending on repeated clicks of the same column", () => {
    let state = DEFAULT_SORT;
    state = nextSortState(state, "price");
    expect(state.direction).toBe("desc");
    state = nextSortState(state, "price");
    expect(state.direction).toBe("asc");
    state = nextSortState(state, "price");
    expect(state.direction).toBe("desc");
  });

  it("resets to a fresh column's own default direction instead of reusing the previous column's direction", () => {
    const priceAsc = nextSortState(nextSortState(DEFAULT_SORT, "price"), "price");
    expect(priceAsc).toEqual({ column: "price", direction: "asc" });

    const switchedToRsi = nextSortState(priceAsc, "rsi");
    expect(switchedToRsi).toEqual({ column: "rsi", direction: "desc" });
  });

  it("is deterministic for equal values regardless of sort direction", () => {
    const tied: RttDashboardRow[] = [
      row({ symbol: "ZZZ", rttScore: 80 }),
      row({ symbol: "AAA", rttScore: 80 }),
      row({ symbol: "MMM", rttScore: 80 }),
    ];

    expect(symbolsOf(sortDashboardRows(tied, { column: "rttScore", direction: "desc" }))).toEqual([
      "AAA",
      "MMM",
      "ZZZ",
    ]);
    expect(symbolsOf(sortDashboardRows(tied, { column: "rttScore", direction: "asc" }))).toEqual([
      "AAA",
      "MMM",
      "ZZZ",
    ]);
  });

  it("does not mutate the input array or the underlying RTT score/rank fields", () => {
    const original = rows.map((r) => ({ ...r }));
    const sorted = sortDashboardRows(rows, { column: "price", direction: "asc" });

    expect(rows).toEqual(original);
    for (const r of sorted) {
      const match = original.find((o) => o.symbol === r.symbol)!;
      expect(r.rttScore).toBe(match.rttScore);
      expect(r.rank).toBe(match.rank);
      expect(r.qualified).toBe(match.qualified);
    }
  });
});
