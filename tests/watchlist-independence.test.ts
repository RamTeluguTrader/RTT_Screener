import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { searchUniverse } from "../src/lib/rtt2x-search";
import {
  __resetWatchlistForTests,
  addToWatchlist,
  getWatchlistSymbols,
} from "../src/lib/watchlist-store";

/**
 * "My Watchlist" is a separate concern from Top 10 / Top 20 / Emerging /
 * Recently Weakened (system-generated) and from Search (research). These
 * modules must never import each other's state, and adding/removing a
 * watchlist symbol must never change what Search or the ranking functions
 * return for a fixed input. Import-graph checks are used here (rather than
 * fabricating large fake Rtt2xLiveRow fixtures) because the actual guarantee
 * under test is structural: rtt2x-screener.ts and rtt2x-search.ts take their
 * data as explicit parameters and hold no reference to the watchlist store
 * at all.
 */

function readSource(relativePath: string): string {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

describe("watchlist independence — module coupling", () => {
  it("rtt2x-screener.ts (Top 10/20/Emerging/Recently Weakened) never imports the watchlist store", () => {
    const source = readSource("src/lib/rtt2x-screener.ts");
    expect(source).not.toMatch(/watchlist-store/);
  });

  it("rtt2x-search.ts never imports the watchlist store", () => {
    const source = readSource("src/lib/rtt2x-search.ts");
    expect(source).not.toMatch(/watchlist-store/);
  });

  it("rtt2x-live-data.ts (the live-data pipeline itself) never imports the watchlist store", () => {
    const source = readSource("src/lib/rtt2x-live-data.ts");
    expect(source).not.toMatch(/watchlist-store/);
  });

  it("watchlist-store.ts never imports the ranking/screener or search modules", () => {
    const source = readSource("src/lib/watchlist-store.ts");
    expect(source).not.toMatch(/rtt2x-screener/);
    expect(source).not.toMatch(/rtt2x-search/);
  });
});

describe("watchlist independence — behavioral", () => {
  it("search results for a fixed query are identical whether or not the stock is watchlisted", () => {
    __resetWatchlistForTests();
    const before = searchUniverse("divi");

    addToWatchlist("DIVISLAB");
    const after = searchUniverse("divi");

    expect(after).toEqual(before);
  });

  it("adding/removing watchlist symbols never mutates the RTT2X_UNIVERSE search source", () => {
    __resetWatchlistForTests();
    const universeBefore = searchUniverse("bank", 20);
    addToWatchlist("HDFCBANK");
    addToWatchlist("ICICIBANK");
    const universeAfter = searchUniverse("bank", 20);
    expect(universeAfter).toEqual(universeBefore);
  });

  it("watchlist membership is unaffected by anything outside the store's own add/remove calls", () => {
    __resetWatchlistForTests();
    addToWatchlist("HAL");
    searchUniverse("anything");
    searchUniverse("pharma");
    expect(getWatchlistSymbols()).toEqual(["HAL"]);
  });
});
