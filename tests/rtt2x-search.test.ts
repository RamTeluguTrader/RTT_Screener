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
    // HAL/BEL/BDL/MAZDOCK sit under NSE's real "Capital Goods" industry
    // classification (the universe uses NSE's own Industry field, not an
    // invented "Defence" category), so a sector-name query for their real
    // sector must still surface them.
    const results = searchUniverse("capital goods", 100);
    const symbols = results.map((r) => r.symbol);
    expect(symbols).toEqual(expect.arrayContaining(["HAL", "BEL", "BDL", "MAZDOCK"]));
  });

  it("finds a partial sector match ('healthcare' -> the real NSE Healthcare industry)", () => {
    const results = searchUniverse("healthcare", 60);
    const symbols = results.map((r) => r.symbol);
    expect(symbols).toEqual(
      expect.arrayContaining(["SUNPHARMA", "AUROPHARMA", "DRREDDY", "CIPLA", "DIVISLAB", "LUPIN"]),
    );
  });

  it("is case-insensitive", () => {
    const lower = searchUniverse("reliance").map((r) => r.symbol);
    const upper = searchUniverse("RELIANCE").map((r) => r.symbol);
    const mixed = searchUniverse("RelIance").map((r) => r.symbol);
    expect(lower.length).toBeGreaterThan(0);
    expect(upper).toEqual(lower);
    expect(mixed).toEqual(lower);
  });

  it("ranks a symbol-prefix match above a sector-prefix match, even for a stock in that sector", () => {
    // POWERGRID's symbol starts with "power" (rank 1); PFC ("Power Finance
    // Corporation") matches via its company name (rank 2); NHPC only matches
    // via the Power sector name itself (rank 3). Prefix/company matches must
    // precede the sector-only match regardless of how many stocks share it.
    const results = searchUniverse("power", 40).map((r) => r.symbol);
    expect(results[0]).toBe("POWERGRID");
    const companyPrefixIndex = results.indexOf("PFC");
    const sectorOnlyIndex = results.indexOf("NHPC");
    expect(companyPrefixIndex).toBeGreaterThan(0);
    expect(sectorOnlyIndex).toBeGreaterThan(companyPrefixIndex);
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
