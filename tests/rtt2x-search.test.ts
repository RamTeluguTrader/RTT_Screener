import { createMemoryHistory, createRouter } from "@tanstack/react-router";
import { describe, expect, it, vi } from "vitest";

import { moveHighlight, resolveSelection, searchUniverse } from "../src/lib/rtt2x-search";
import { routeTree } from "../src/routeTree.gen";

describe("searchUniverse", () => {
  it("finds an exact symbol match", () => {
    const results = searchUniverse("DIVISLAB");
    expect(results[0]?.symbol).toBe("DIVISLAB");
  });

  it("finds a partial/prefix symbol match", () => {
    const results = searchUniverse("divi");
    expect(results.some((r) => r.symbol === "DIVISLAB")).toBe(true);
    expect(results[0]?.symbol).toBe("DIVISLAB");
  });

  it("finds a company-name match", () => {
    const results = searchUniverse("laboratories");
    const symbols = results.map((r) => r.symbol);
    expect(symbols).toContain("DIVISLAB");
    expect(symbols).toContain("DRREDDY");
  });

  it("finds a sector match", () => {
    const results = searchUniverse("defence");
    const symbols = results.map((r) => r.symbol);
    expect(symbols).toEqual(expect.arrayContaining(["HAL", "BEL", "BDL", "MAZDOCK", "ASTRAMICRO", "PARAS"]));
  });

  it("finds a partial sector match ('pharma' -> Pharmaceuticals)", () => {
    const results = searchUniverse("pharma", 20);
    const symbols = results.map((r) => r.symbol);
    expect(symbols).toEqual(
      expect.arrayContaining(["SUNPHARMA", "AUROPHARMA", "DRREDDY", "CIPLA", "DIVISLAB", "LUPIN"]),
    );
  });

  it("is case-insensitive", () => {
    const lower = searchUniverse("reliance").map((r) => r.symbol);
    const upper = searchUniverse("RELIANCE").map((r) => r.symbol);
    const mixed = searchUniverse("RelIance").map((r) => r.symbol);
    expect(lower).toEqual(["RELIANCE"]);
    expect(upper).toEqual(lower);
    expect(mixed).toEqual(lower);
  });

  it("ranks a symbol-prefix match above a sector-prefix match, even for a stock in that sector", () => {
    // POWERGRID's symbol starts with "power" (rank 1); the rest of the Power sector
    // only matches via the sector name itself (rank 3). POWERGRID must come first.
    const results = searchUniverse("power", 20);
    expect(results[0]?.symbol).toBe("POWERGRID");
    const rest = results.slice(1).map((r) => r.symbol);
    expect(rest).toEqual(["JSWENERGY", "NHPC", "NTPC", "SJVN", "TATAPOWER"]);
  });

  it("returns an empty array for no match, without throwing", () => {
    expect(() => searchUniverse("zzz-not-a-real-stock-zzz")).not.toThrow();
    expect(searchUniverse("zzz-not-a-real-stock-zzz")).toEqual([]);
  });

  it("returns an empty array for an empty or whitespace-only query", () => {
    expect(searchUniverse("")).toEqual([]);
    expect(searchUniverse("   ")).toEqual([]);
  });

  it("respects the result limit", () => {
    const results = searchUniverse("a", 3);
    expect(results.length).toBeLessThanOrEqual(3);
  });

  it("never makes a network request", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    searchUniverse("HAL");
    searchUniverse("pharma");
    searchUniverse("defence");
    searchUniverse("divi");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("does not mutate its own results between calls", () => {
    const first = searchUniverse("bank");
    const second = searchUniverse("bank");
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
  });
});

describe("moveHighlight", () => {
  it("moves down from no selection to the first result", () => {
    expect(moveHighlight(-1, "down", 5)).toBe(0);
  });

  it("moves up from no selection to the last result", () => {
    expect(moveHighlight(-1, "up", 5)).toBe(4);
  });

  it("clamps at the last result going down", () => {
    expect(moveHighlight(4, "down", 5)).toBe(4);
  });

  it("clamps at the first result going up", () => {
    expect(moveHighlight(0, "up", 5)).toBe(0);
  });

  it("returns -1 when there are no results", () => {
    expect(moveHighlight(-1, "down", 0)).toBe(-1);
    expect(moveHighlight(2, "up", 0)).toBe(-1);
  });
});

describe("resolveSelection (Enter-to-select)", () => {
  const results = searchUniverse("bank", 20);

  it("selects the highlighted result when one is set", () => {
    expect(resolveSelection(results, 1)).toEqual(results[1]);
  });

  it("falls back to the first result when nothing is highlighted", () => {
    expect(resolveSelection(results, -1)).toEqual(results[0]);
  });

  it("returns null for an empty result set", () => {
    expect(resolveSelection([], -1)).toBeNull();
  });
});

describe("search result navigation (routing contract, matches tests/navigation.test.ts convention)", () => {
  it("resolves every search result to its /stock/{SYMBOL} detail route", () => {
    const router = createRouter({ routeTree, history: createMemoryHistory({ initialEntries: ["/"] }) });
    const candidates = ["divi", "reli", "hal", "tcs"];

    for (const query of candidates) {
      const results = searchUniverse(query);
      expect(results.length).toBeGreaterThan(0);
      for (const stock of results) {
        const location = router.buildLocation({ to: "/stock/$symbol", params: { symbol: stock.symbol } });
        expect(location.pathname).toBe(`/stock/${stock.symbol}`);
      }
    }
  });

  it("resolves the Enter-to-select target for a query to the correct route", () => {
    const router = createRouter({ routeTree, history: createMemoryHistory({ initialEntries: ["/"] }) });
    const results = searchUniverse("divi");
    const selected = resolveSelection(results, -1);
    expect(selected?.symbol).toBe("DIVISLAB");
    const location = router.buildLocation({ to: "/stock/$symbol", params: { symbol: selected!.symbol } });
    expect(location.pathname).toBe("/stock/DIVISLAB");
  });
});
