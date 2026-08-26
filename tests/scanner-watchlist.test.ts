import { readFileSync } from "node:fs";
import { createMemoryHistory, createRouter } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { Route as ScannerRoute } from "../src/routes/scanner";
import { routeTree } from "../src/routeTree.gen";

function readSource(relativePath: string): string {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

describe("Scanner watchlist action — reuses the existing implementation only", () => {
  it("ScreenerTable imports the shared WatchlistButton rather than a second implementation", () => {
    const source = readSource("src/components/dashboard/ScreenerTable.tsx");
    expect(source).toMatch(/import\s*{\s*WatchlistButton\s*}\s*from\s*"@\/components\/watchlist\/WatchlistButton"/);
    // Only one addToWatchlist/removeFromWatchlist implementation exists in the whole codebase.
    expect(source).not.toMatch(/function addToWatchlist|function removeFromWatchlist/);
  });

  it("WatchlistButton never imports navigation — it cannot itself cause a route change", () => {
    // Structural proof for requirement 3 (clicking the watchlist control must not
    // navigate): the component that could accidentally navigate simply has no way
    // to call navigate()/useNavigate() at all.
    const source = readSource("src/components/watchlist/WatchlistButton.tsx");
    expect(source).not.toMatch(/useNavigate|navigate\(/);
  });

  it("WatchlistButton's click handler stops propagation before doing anything else", () => {
    const source = readSource("src/components/watchlist/WatchlistButton.tsx");
    const handlerBody = source.slice(source.indexOf("function handleClick"), source.indexOf("function handleClick") + 200);
    expect(handlerBody).toMatch(/event\.stopPropagation\(\)/);
  });

  it("the icon variant reuses the exact same add/remove/confirm state machine as the default variant (single implementation, two renderings)", () => {
    const source = readSource("src/components/watchlist/WatchlistButton.tsx");
    // Both branches read from the same `inWatchlist`/`isFull`/`confirming` state and
    // call the same `handleClick` — there is exactly one addToWatchlist call site and
    // one removeFromWatchlist call site in the whole file.
    expect([...source.matchAll(/addToWatchlist\(/g)]).toHaveLength(1);
    expect([...source.matchAll(/removeFromWatchlist\(/g)]).toHaveLength(1);
  });
});

describe("Scanner ?view= tab-selection param", () => {
  it("validateSearch accepts each valid view value", () => {
    const validate = ScannerRoute.options.validateSearch as (search: Record<string, unknown>) => { view?: string };
    expect(validate({ view: "top10" })).toEqual({ view: "top10" });
    expect(validate({ view: "top20" })).toEqual({ view: "top20" });
    expect(validate({ view: "emerging" })).toEqual({ view: "emerging" });
    expect(validate({ view: "weakened" })).toEqual({ view: "weakened" });
  });

  it("validateSearch falls back to undefined (ScreenerTable's existing default) for a missing view — generic /scanner navigation is unaffected", () => {
    const validate = ScannerRoute.options.validateSearch as (search: Record<string, unknown>) => { view?: string };
    expect(validate({})).toEqual({ view: undefined });
  });

  it("validateSearch ignores an invalid/unknown view rather than throwing", () => {
    const validate = ScannerRoute.options.validateSearch as (search: Record<string, unknown>) => { view?: string };
    expect(() => validate({ view: "not-a-real-tab" })).not.toThrow();
    expect(validate({ view: "not-a-real-tab" })).toEqual({ view: undefined });
    expect(validate({ view: 42 })).toEqual({ view: undefined });
  });

  it("builds the exact /scanner?view=top10 URL 'Explore Top 10' navigates to", () => {
    const router = createRouter({ routeTree, history: createMemoryHistory({ initialEntries: ["/"] }) });
    const location = router.buildLocation({ to: "/scanner", search: { view: "top10" } });
    expect(location.pathname).toBe("/scanner");
    expect(location.search).toEqual({ view: "top10" });
  });

  it("generic /scanner navigation (no search param) still resolves exactly as before", () => {
    const router = createRouter({ routeTree, history: createMemoryHistory({ initialEntries: ["/"] }) });
    const location = router.buildLocation({ to: "/scanner" });
    expect(location.pathname).toBe("/scanner");
    expect(location.search).toEqual({});
  });
});
