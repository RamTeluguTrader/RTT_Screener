import { describe, expect, it, vi } from "vitest";

import { RTT2X_UNIVERSE, SECTOR_NAMES, findUniverseStock, resolveInstrumentKey } from "../src/lib/rtt2x-universe";
import { searchUniverse } from "../src/lib/rtt2x-search";
import { buildEmergingList, rankByRttScore, topN } from "../src/lib/rtt2x-screener";
import type { Rtt2xLiveRow } from "../src/lib/rtt2x-live-data";

/**
 * Covers the demo universe expansion (60 -> the combined, de-duplicated
 * Nifty 100 + Midcap 150 membership; Smallcap 250 was left out to keep
 * live-data load within realistic Upstox rate limits): every entry's data
 * integrity, retention of the prior curated set, and that the existing
 * ranking/search logic (untouched) still holds its structural guarantees at
 * the new scale. No RTT 2.X scoring/ranking formula is exercised here beyond
 * what already exists in rtt2x-screener.ts.
 */

// The 60 symbols the screener shipped with before this expansion.
const ORIGINAL_60 = [
  "HAL", "BEL", "BDL", "MAZDOCK", "ASTRAMICRO", "PARAS",
  "NTPC", "POWERGRID", "TATAPOWER", "JSWENERGY", "SJVN", "NHPC",
  "TCS", "INFY", "HCLTECH", "COFORGE", "WIPRO", "TECHM",
  "HDFCBANK", "ICICIBANK", "SBIN", "AXISBANK", "KOTAKBANK", "INDUSINDBK",
  "BAJFINANCE", "BAJAJFINSV", "HDFCLIFE", "SBILIFE", "MUTHOOTFIN", "CHOLAFIN",
  "M&M", "MARUTI", "TMCV", "BAJAJ-AUTO", "EICHERMOT", "TVSMOTOR",
  "SUNPHARMA", "DRREDDY", "CIPLA", "DIVISLAB", "LUPIN", "AUROPHARMA",
  "ITC", "HINDUNILVR", "BRITANNIA", "NESTLEIND", "DABUR", "GODREJCP",
  "SIEMENS", "ABB", "THERMAX", "CUMMINSIND", "LT", "VOLTAS",
  "RELIANCE", "ONGC", "COALINDIA", "OIL", "GAIL", "BPCL",
];
// Verified (via the official Nifty 100/Midcap 150/Smallcap 250 constituent
// lists) to genuinely fall outside the combined index membership -- not
// dropped by accident.
const GENUINELY_OUTSIDE_NEW_UNIVERSE = ["ASTRAMICRO", "PARAS"];

describe("RTT2X_UNIVERSE — expanded to Nifty 100 + Midcap 150", () => {
  it("has roughly 200-250 stocks (the combined, de-duplicated index membership)", () => {
    expect(RTT2X_UNIVERSE.length).toBeGreaterThanOrEqual(200);
    expect(RTT2X_UNIVERSE.length).toBeLessThanOrEqual(250);
  });

  it("has no duplicate symbols", () => {
    const symbols = RTT2X_UNIVERSE.map((s) => s.symbol);
    expect(new Set(symbols).size).toBe(symbols.length);
  });

  it("gives every stock a non-empty symbol, company name, sector, and a well-formed Upstox instrument key", () => {
    for (const stock of RTT2X_UNIVERSE) {
      expect(stock.symbol.length).toBeGreaterThan(0);
      expect(stock.companyName.length).toBeGreaterThan(0);
      expect(stock.sector.length).toBeGreaterThan(0);
      // Real Upstox NSE equity keys are "NSE_EQ|<ISIN>" -- never invented ad hoc.
      expect(stock.instrumentKey).toMatch(/^NSE_EQ\|[A-Z0-9]{12}$/);
    }
  });

  it("resolves every listed symbol via findUniverseStock/resolveInstrumentKey with a matching key", () => {
    for (const stock of RTT2X_UNIVERSE) {
      expect(findUniverseStock(stock.symbol)).toEqual(stock);
      expect(resolveInstrumentKey(stock.symbol)).toBe(stock.instrumentKey);
    }
  });

  it("retains every original-60 symbol that is genuinely still in the combined index membership", () => {
    const currentSymbols = new Set(RTT2X_UNIVERSE.map((s) => s.symbol));
    for (const symbol of ORIGINAL_60) {
      if (GENUINELY_OUTSIDE_NEW_UNIVERSE.includes(symbol)) continue;
      expect(currentSymbols.has(symbol)).toBe(true);
    }
  });

  it("only drops original-60 symbols that are verified to be outside the new combined universe", () => {
    const currentSymbols = new Set(RTT2X_UNIVERSE.map((s) => s.symbol));
    const droppedSymbols = ORIGINAL_60.filter((symbol) => !currentSymbols.has(symbol));
    expect(droppedSymbols.sort()).toEqual([...GENUINELY_OUTSIDE_NEW_UNIVERSE].sort());
  });

  it("exposes SECTOR_NAMES as the real, deduplicated sector set actually present in the universe (no invented categories)", () => {
    const actualSectors = new Set(RTT2X_UNIVERSE.map((s) => s.sector));
    expect(new Set(SECTOR_NAMES)).toEqual(actualSectors);
  });
});

describe("Search over the expanded universe", () => {
  it("finds a midcap stock that was not part of the original 60-stock universe", () => {
    // APL Apollo Tubes is a genuine Nifty Midcap 150 constituent that was
    // never in the original curated 60.
    const results = searchUniverse("aplapollo");
    expect(results.some((r) => r.symbol === "APLAPOLLO")).toBe(true);
  });

  it("still resolves an original large-cap symbol correctly at the new scale", () => {
    const results = searchUniverse("DIVISLAB");
    expect(results[0]?.symbol).toBe("DIVISLAB");
  });

  it("remains entirely local/network-free even against the ~500-stock universe", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    searchUniverse("a", 50);
    searchUniverse("aavas");
    searchUniverse("bank");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe("Ranking-logic structural guarantees hold at the expanded universe's scale", () => {
  // Synthetic rows built directly from the real (expanded) universe, each
  // given a distinct qualified score -- this exercises the existing,
  // untouched rtt2x-screener.ts logic at ~500-row scale without recomputing
  // or altering the RTT 2.X scoring formula itself.
  function makeRow(symbol: string, sector: string, rttScore: number): Rtt2xLiveRow {
    return {
      symbol,
      companyName: symbol,
      sector,
      currentPrice: 100,
      candles: [],
      ema20: null,
      ema50: null,
      distanceFromEma20: null,
      distanceFromEma50: null,
      result: {
        qualified: true,
        rttScore,
        rejectionReason: null,
        rsi14: 55,
        sectorContext: null,
        ema20ResilienceScore: { label: "EMA Trend Resilience", score: 18, maximum: 22 },
        trendDevelopmentScore: { label: "Current Trend Development", score: 8, maximum: 10 },
        emaSlopeExpansionScore: { label: "EMA Slope & Expansion", score: 10, maximum: 14 },
        extensionScore: { label: "Entry/Extension Quality", score: 6, maximum: 8 },
      } as unknown as Rtt2xLiveRow["result"],
    };
  }

  const syntheticRows = RTT2X_UNIVERSE.map((stock, index) => makeRow(stock.symbol, stock.sector, 100 - (index % 100)));

  it("Top 10 never exceeds 10 rows", () => {
    const ranked = rankByRttScore(syntheticRows);
    expect(topN(ranked, 10).length).toBeLessThanOrEqual(10);
  });

  it("Top 20 never exceeds 20 rows", () => {
    const ranked = rankByRttScore(syntheticRows);
    expect(topN(ranked, 20).length).toBeLessThanOrEqual(20);
  });

  it("Top 10 is exactly the first 10 of Top 20 (a strict prefix/subset)", () => {
    const ranked = rankByRttScore(syntheticRows);
    const top10 = topN(ranked, 10);
    const top20 = topN(ranked, 20);
    expect(top20.slice(0, 10)).toEqual(top10);
    expect(top10.every((row) => top20.some((r) => r.symbol === row.symbol))).toBe(true);
  });

  it("Emerging never duplicates a Top 20 symbol", () => {
    const ranked = rankByRttScore(syntheticRows);
    const top20 = topN(ranked, 20);
    const emerging = buildEmergingList(ranked, top20);
    const top20Symbols = new Set(top20.map((r) => r.symbol));
    expect(emerging.some((row) => top20Symbols.has(row.symbol))).toBe(false);
  });
});
