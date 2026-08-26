import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { searchUniverse } from "../src/lib/rtt2x-search";
import { __resetWatchlistForTests, addToWatchlist, getWatchlistSymbols, WATCHLIST_MAX } from "../src/lib/watchlist-store";

function readSource(relativePath: string): string {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

describe("Global Search watchlist action — reuses the existing implementation only", () => {
  it("GlobalSearch renders a watchlist action via the shared WatchlistButton for every result", () => {
    const source = readSource("src/components/layout/GlobalSearch.tsx");
    expect(source).toMatch(/import\s*{\s*WatchlistButton\s*}\s*from\s*"@\/components\/watchlist\/WatchlistButton"/);
    expect(source).toMatch(/<WatchlistButton\s+symbol={stock\.symbol}\s+variant="compact"\s*\/>/);
    // No second store/implementation introduced in this file.
    expect(source).not.toMatch(/function addToWatchlist|function removeFromWatchlist/);
  });

  it("the watchlist action is a sibling of the navigate button, not nested inside it (avoids invalid nested <button>)", () => {
    const source = readSource("src/components/layout/GlobalSearch.tsx");
    const resultBlock = source.slice(source.indexOf("{results.map"), source.indexOf("</ul>"));
    // The navigate button (onClick={() => selectResult(stock)}) must close with its own
    // </button> BEFORE the WatchlistButton usage appears, proving they are siblings.
    const navigateButtonEnd = resultBlock.indexOf("</button>");
    const watchlistButtonUsage = resultBlock.indexOf("<WatchlistButton");
    expect(navigateButtonEnd).toBeGreaterThan(-1);
    expect(watchlistButtonUsage).toBeGreaterThan(navigateButtonEnd);
  });

  it("the watchlist action's wrapper also blocks input blur (onMouseDown preventDefault), so the dropdown stays open", () => {
    const source = readSource("src/components/layout/GlobalSearch.tsx");
    const watchlistUsageIndex = source.indexOf("<WatchlistButton");
    const precedingMarkup = source.slice(Math.max(0, watchlistUsageIndex - 120), watchlistUsageIndex);
    expect(precedingMarkup).toMatch(/onMouseDown=\{\(event\) => event\.preventDefault\(\)\}/);
  });

  it("WatchlistButton (used for the search action) never imports navigation and always stops propagation", () => {
    // Same structural guarantee already relied on for the Scanner integration —
    // re-asserted here because this is what makes requirement 3/5 true for Search.
    const source = readSource("src/components/watchlist/WatchlistButton.tsx");
    expect(source).not.toMatch(/useNavigate|navigate\(/);
    const handlerBody = source.slice(source.indexOf("function handleClick"), source.indexOf("function handleClick") + 200);
    expect(handlerBody).toMatch(/event\.stopPropagation\(\)/);
  });

  it("the compact variant renders the same star icon and Add/Watching labels described in the request, from the same state machine", () => {
    const source = readSource("src/components/watchlist/WatchlistButton.tsx");
    const compactBlock = source.slice(source.indexOf('variant === "compact"'), source.indexOf('variant === "compact"') + 1200);
    expect(compactBlock).toMatch(/"Watching"/);
    expect(compactBlock).toMatch(/"Add"/);
    expect(compactBlock).toMatch(/<Star/);
    // Uses the same handleClick / inWatchlist / isFull / confirming state as every other variant.
    expect(compactBlock).toMatch(/onClick=\{handleClick\}/);
    expect(compactBlock).toMatch(/disabled=\{isFull\}/);
  });
});

describe("Global Search watchlist action — store behavior (add/remove/limit reuse the real store)", () => {
  beforeEach(() => {
    __resetWatchlistForTests();
  });

  it("a symbol found via search can be added to the real watchlist store", () => {
    const [result] = searchUniverse("divi");
    expect(result?.symbol).toBe("DIVISLAB");
    expect(addToWatchlist(result!.symbol)).toBe("added");
    expect(getWatchlistSymbols()).toContain("DIVISLAB");
  });

  it("respects the existing 20-stock limit for a stock discovered via search", () => {
    for (let i = 0; i < WATCHLIST_MAX; i += 1) addToWatchlist(`SYM${i}`);
    const [result] = searchUniverse("divi");
    expect(addToWatchlist(result!.symbol)).toBe("full");
    expect(getWatchlistSymbols()).not.toContain("DIVISLAB");
  });

  it("search results are unaffected by watchlist membership either way (already covered structurally, re-verified here)", () => {
    const before = searchUniverse("divi");
    addToWatchlist("DIVISLAB");
    const after = searchUniverse("divi");
    expect(after).toEqual(before);
  });

  it("searching itself makes zero network requests, including right after a watchlist mutation", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    searchUniverse("divi");
    addToWatchlist("DIVISLAB");
    searchUniverse("divi");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
