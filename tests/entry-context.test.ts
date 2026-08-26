import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  calculate52WeekHigh,
  calculateDistanceFrom52WHighPct,
  classifyEntryContext,
  ENTRY_CONTEXT_COMPACT_LABEL,
  entryContextExplanation,
  getEntryContext,
  type EntryContext,
  type EntryContextResult,
} from "../src/lib/entry-context";
import type { Candle } from "../src/lib/technical-analysis";
import { rankByRttScore, topN } from "../src/lib/rtt2x-screener";
import type { Rtt2xLiveRow } from "../src/lib/rtt2x-live-data";

/**
 * Entry Context is a presentation-only lens (see entry-context.ts) — these
 * tests cover the classification rules from the final spec exactly (no
 * reinterpreted thresholds), plus the guarantee that it never touches RTT
 * score, qualification, or ranking.
 */

describe("classifyEntryContext — final spec boundary tests", () => {
  it("1. 3% above EMA20, 8% below 52W high -> Favorable Context", () => {
    expect(classifyEntryContext(3, -8)).toBe("Favorable Context");
  });

  it("2. 5% above EMA20, 6% below 52W high -> Favorable Context (exact 5% EMA20 boundary, inclusive)", () => {
    expect(classifyEntryContext(5, -6)).toBe("Favorable Context");
  });

  it("3. 5.1% above EMA20, 10% below 52W high -> Extended — Watch for Pullback", () => {
    expect(classifyEntryContext(5.1, -10)).toBe("Extended — Watch for Pullback");
  });

  it("4. 7% above EMA20, 10% below 52W high -> Extended — Watch for Pullback", () => {
    expect(classifyEntryContext(7, -10)).toBe("Extended — Watch for Pullback");
  });

  it("5. exactly 12% above EMA20, 10% below 52W high -> Extended — Watch for Pullback (exact 12% EMA20 boundary, inclusive)", () => {
    expect(classifyEntryContext(12, -10)).toBe("Extended — Watch for Pullback");
  });

  it("6. 12.1% above EMA20 -> Highly Extended", () => {
    expect(classifyEntryContext(12.1, -10)).toBe("Highly Extended");
  });

  it("7. 3% above EMA20, exactly at 52W high -> Extended — Watch for Pullback", () => {
    expect(classifyEntryContext(3, 0)).toBe("Extended — Watch for Pullback");
  });

  it("8. 3% above EMA20, 1% below 52W high -> Extended — Watch for Pullback", () => {
    expect(classifyEntryContext(3, -1)).toBe("Extended — Watch for Pullback");
  });

  it("9. 6% above EMA20, 1% below 52W high -> Highly Extended", () => {
    expect(classifyEntryContext(6, -1)).toBe("Highly Extended");
  });

  it("10. 6% above EMA20, exactly 2% below 52W high -> Highly Extended (exact 2% 52W-high boundary, inclusive)", () => {
    expect(classifyEntryContext(6, -2)).toBe("Highly Extended");
  });

  it("11. 2% above EMA20, 4% below 52W high -> Extended — Watch for Pullback", () => {
    expect(classifyEntryContext(2, -4)).toBe("Extended — Watch for Pullback");
  });

  it("12. insufficient 252-session history (null 52W distance) -> Neutral", () => {
    expect(classifyEntryContext(15, null)).toBe("Neutral");
  });

  it("13. price below EMA20 with sufficient 52W data -> Neutral", () => {
    expect(classifyEntryContext(-3, -20)).toBe("Neutral");
  });

  it("14. Highly Extended always takes priority over Extended when both conditions would independently match", () => {
    // 7% above EMA20 alone satisfies the Extended rule (2A: >5 and <=12);
    // -1% from the 52W high alone satisfies both the Highly Extended rule
    // (1B: >5 and >=-2) and the Extended rule (2B: >=-5). Highly Extended
    // must win.
    expect(classifyEntryContext(7, -1)).toBe("Highly Extended");
  });

  it("15. Entry Context classification never touches the RTT score result", () => {
    const before: EntryContextResult = getEntryContext({ candles: [], currentPrice: 100, distanceFromEma20: 7 });
    expect(before.context).toBe("Neutral"); // no candles -> no 52W high -> Neutral, per spec
    // Nothing in entry-context.ts imports from the RTT 2.X scoring/config modules.
    const source = readFileSync(new URL("../src/lib/entry-context.ts", import.meta.url), "utf8");
    const importLines = source.split("\n").filter((line) => line.trim().startsWith("import"));
    expect(importLines.join("\n")).not.toMatch(/rtt2x-score|rtt2x-config/);
  });
});

describe("exact 5% 52W-high boundary", () => {
  it("exactly -5% from the 52W high -> Extended — Watch for Pullback (inclusive)", () => {
    expect(classifyEntryContext(2, -5)).toBe("Extended — Watch for Pullback");
  });

  it("-5.1% from the 52W high (just past the boundary), with EMA20 in the Favorable range -> Favorable Context", () => {
    expect(classifyEntryContext(2, -5.1)).toBe("Favorable Context");
  });
});

describe("exact 2% 52W-high boundary (just outside)", () => {
  it("-2.1% from the 52W high (just past the Highly Extended boundary) falls back to Extended", () => {
    expect(classifyEntryContext(6, -2.1)).toBe("Extended — Watch for Pullback");
  });
});

describe("calculate52WeekHigh", () => {
  function makeCandles(highs: number[]): Candle[] {
    return highs.map((high, index) => ({ timestamp: index, open: high, high, low: high, close: high, volume: 1000 }));
  }

  it("returns null when fewer than 252 sessions are available (insufficient history)", () => {
    expect(calculate52WeekHigh(makeCandles(Array(251).fill(100)))).toBeNull();
  });

  it("returns the maximum high over exactly the trailing 252 sessions", () => {
    const highs = Array(252).fill(100);
    highs[100] = 150;
    expect(calculate52WeekHigh(makeCandles(highs))).toBe(150);
  });

  it("never looks ahead: only considers candles actually passed in, ignoring nothing beyond the array boundary", () => {
    // Simulate "current evaluation date" as candle #259 out of 300 by only
    // passing the first 260 candles. A huge spike placed only in the
    // remaining (future, un-passed) candles must never affect the result.
    const highs = Array(300).fill(100);
    for (let i = 260; i < 300; i += 1) highs[i] = 9999; // "future" spike, never passed in
    const upToEvaluationDate = makeCandles(highs).slice(0, 260);
    expect(calculate52WeekHigh(upToEvaluationDate)).toBe(100);
  });

  it("does not invent a 52-week high with zero candles", () => {
    expect(calculate52WeekHigh([])).toBeNull();
  });
});

describe("calculateDistanceFrom52WHighPct", () => {
  it("computes 0% exactly at the 52-week high", () => {
    expect(calculateDistanceFrom52WHighPct(100, 100)).toBe(0);
  });

  it("computes a negative percentage below the 52-week high", () => {
    expect(calculateDistanceFrom52WHighPct(95, 100)).toBeCloseTo(-5, 5);
  });

  it("returns null when either input is unavailable", () => {
    expect(calculateDistanceFrom52WHighPct(null, 100)).toBeNull();
    expect(calculateDistanceFrom52WHighPct(100, null)).toBeNull();
  });
});

describe("getEntryContext — wiring from already-available row data (no new fetch)", () => {
  it("reuses the row's existing distanceFromEma20 as-is, never recomputing it differently", () => {
    const result = getEntryContext({ candles: [], currentPrice: 100, distanceFromEma20: 3.456 });
    expect(result.distanceFromEma20Pct).toBe(3.456);
  });

  it("returns Neutral with null distances when no candle history is available", () => {
    const result = getEntryContext({ candles: [], currentPrice: 100, distanceFromEma20: 7 });
    expect(result.context).toBe("Neutral");
    expect(result.distanceFrom52WHighPct).toBeNull();
    expect(result.high52Week).toBeNull();
  });
});

describe("entryContextExplanation — factual only, never an instruction", () => {
  it("describes an above-EMA20, near-52W-high stock factually", () => {
    const text = entryContextExplanation({ context: "Highly Extended", distanceFromEma20Pct: 6.1, distanceFrom52WHighPct: -1.2, high52Week: 100 });
    expect(text).toBe("Price is 6.1% above EMA20 and within 2% of its 52-week high.");
  });

  it("never contains buy/sell/hold/recommendation/instruction language", () => {
    const samples: EntryContextResult[] = [
      { context: "Highly Extended", distanceFromEma20Pct: 15, distanceFrom52WHighPct: -0.5, high52Week: 100 },
      { context: "Favorable Context", distanceFromEma20Pct: 2, distanceFrom52WHighPct: -8, high52Week: 100 },
      { context: "Neutral", distanceFromEma20Pct: null, distanceFrom52WHighPct: null, high52Week: null },
    ];
    for (const sample of samples) {
      const text = entryContextExplanation(sample).toLowerCase();
      expect(text).not.toMatch(/\bbuy\b|\bsell\b|\bhold\b|\bsignal\b|\brecommended\b|\btarget\b|stop.?loss/);
    }
  });
});

describe("Entry Context never changes RTT score or ranking", () => {
  // 252 sessions with a low, stable high (80) so the 52-week high itself
  // never drives the classification here — only distanceFromEma20 does.
  const stableCandleHistory: Rtt2xLiveRow["candles"] = Array.from({ length: 252 }, (_, index) => ({
    timestamp: index,
    open: 80,
    high: 80,
    low: 80,
    close: 80,
    volume: 1000,
  }));

  function makeRow(symbol: string, rttScore: number, extended: boolean): Rtt2xLiveRow {
    return {
      symbol,
      companyName: symbol,
      sector: "Test",
      currentPrice: 100,
      candles: stableCandleHistory,
      ema20: 100,
      ema50: 95,
      distanceFromEma20: extended ? 15 : 2,
      distanceFromEma50: 5,
      result: { qualified: true, rttScore } as unknown as Rtt2xLiveRow["result"],
    };
  }

  it("computing Entry Context for a row does not mutate or alter its RTT score", () => {
    const row = makeRow("AAA", 89.5, true);
    const before = row.result.rttScore;
    getEntryContext(row);
    expect(row.result.rttScore).toBe(before);
    expect(row.result.rttScore).toBe(89.5);
  });

  it("ranking (rankByRttScore/topN) is identical whether or not Entry Context is computed for the rows", () => {
    const rows = [makeRow("HIGH", 90, true), makeRow("MID", 60, false), makeRow("LOW", 40, true)];
    const rankedBefore = rankByRttScore(rows).map((r) => r.symbol);

    // Computing Entry Context for every row (as the UI does) must not
    // reorder anything.
    for (const row of rows) getEntryContext(row);

    const rankedAfter = rankByRttScore(rows).map((r) => r.symbol);
    expect(rankedAfter).toEqual(rankedBefore);
    expect(rankedAfter).toEqual(["HIGH", "MID", "LOW"]);
    expect(topN(rankByRttScore(rows), 2).map((r) => r.symbol)).toEqual(["HIGH", "MID"]);
  });

  it("a Highly Extended stock is never filtered out of ranked results", () => {
    const rows = [makeRow("HIGH", 90, true)]; // Highly Extended per makeRow(..., true)
    const ranked = rankByRttScore(rows);
    expect(ranked.map((r) => r.symbol)).toContain("HIGH");
    const entry = getEntryContext(rows[0]!);
    expect(entry.context).toBe("Highly Extended");
  });
});

describe("ENTRY_CONTEXT_COMPACT_LABEL — Scanner-only display mapping, not a second classification", () => {
  it("maps every EntryContext to its compact Scanner label", () => {
    expect(ENTRY_CONTEXT_COMPACT_LABEL["Favorable Context"]).toBe("Favorable");
    expect(ENTRY_CONTEXT_COMPACT_LABEL["Extended — Watch for Pullback"]).toBe("Extended");
    expect(ENTRY_CONTEXT_COMPACT_LABEL["Highly Extended"]).toBe("Highly Extended");
    expect(ENTRY_CONTEXT_COMPACT_LABEL.Neutral).toBe("Neutral");
  });

  it("has exactly one compact label per EntryContext value (no extra/missing entries)", () => {
    const allContexts: EntryContext[] = ["Favorable Context", "Extended — Watch for Pullback", "Highly Extended", "Neutral"];
    expect(Object.keys(ENTRY_CONTEXT_COMPACT_LABEL).sort()).toEqual(allContexts.slice().sort());
  });
});

describe("Scanner uses the compact label with the full label as hover text; Stock Detail keeps the full label", () => {
  it("ScreenerTable's Entry Context badge shows the compact label and exposes the full label via title/aria-label", () => {
    const source = readFileSync(new URL("../src/components/dashboard/ScreenerTable.tsx", import.meta.url), "utf8");
    const badgeFn = source.slice(source.indexOf("function EntryContextBadge"), source.indexOf("function EntryContextBadge") + 600);
    expect(badgeFn).toMatch(/title=\{context\}/);
    expect(badgeFn).toMatch(/aria-label=\{context\}/);
    expect(badgeFn).toMatch(/ENTRY_CONTEXT_COMPACT_LABEL\[context\]/);
    // Must not render the full EntryContext string directly as the visible label.
    expect(badgeFn).not.toMatch(/>\s*\{context\}\s*<\/span>/);
  });

  it("ScreenerTable does not introduce a second Entry Context calculation (still calls the shared getEntryContext)", () => {
    const source = readFileSync(new URL("../src/components/dashboard/ScreenerTable.tsx", import.meta.url), "utf8");
    expect(source).toMatch(/import\s*\{[^}]*getEntryContext[^}]*\}\s*from\s*"@\/lib\/entry-context"/);
    expect(source).not.toMatch(/function classifyEntryContext|function calculate52WeekHigh/);
  });

  it("Stock Detail still renders the full (non-compact) Entry Context label", () => {
    const source = readFileSync(new URL("../src/routes/stock-detail.tsx", import.meta.url), "utf8");
    expect(source).not.toMatch(/ENTRY_CONTEXT_COMPACT_LABEL/);
    expect(source).toMatch(/entryContext\.context/);
  });
});
