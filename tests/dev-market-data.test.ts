import { describe, expect, it } from "vitest";

import {
  DEVELOPMENT_MARKET_STOCKS,
  DEVELOPMENT_SECTOR_STRENGTHS,
  IS_DEVELOPMENT_DATA,
  toRttScoreInput,
} from "../src/lib/dev-market-data";
import { calculateRttScore } from "../src/lib/rtt-score";

describe("development market dataset", () => {
  it("exposes a synthetic dataset with the expected size and sector coverage", () => {
    expect(IS_DEVELOPMENT_DATA).toBe(true);
    expect(DEVELOPMENT_MARKET_STOCKS.length).toBe(60);
    expect(DEVELOPMENT_MARKET_STOCKS.length).toBeGreaterThanOrEqual(50);
    expect(DEVELOPMENT_MARKET_STOCKS.length).toBeLessThanOrEqual(100);
    expect(new Set(DEVELOPMENT_MARKET_STOCKS.map((stock) => stock.sector)).size).toBeGreaterThanOrEqual(6);
    expect(DEVELOPMENT_SECTOR_STRENGTHS.length).toBeGreaterThanOrEqual(6);
  });

  it("includes the requested RTT scenarios and passes through the scoring engine", () => {
    const scenarios = new Set(DEVELOPMENT_MARKET_STOCKS.map((stock) => stock.scenario));

    expect(scenarios).toEqual(new Set([
      "STRONG",
      "MODERATE",
      "WEAK",
      "EMA_MISALIGNED",
      "RSI_LOW",
      "RSI_HIGH",
      "RSI_50",
      "RSI_75",
    ]));

    const results = DEVELOPMENT_MARKET_STOCKS.map((stock) => calculateRttScore(toRttScoreInput(stock)));

    expect(results.some((result) => result.qualified)).toBe(true);
    expect(results.some((result) => !result.qualified)).toBe(true);

    const qualified = results.filter((result) => result.qualified);
    const rejected = results.filter((result) => !result.qualified);

    expect(qualified.length).toBeGreaterThan(0);
    expect(rejected.length).toBeGreaterThan(0);

    for (const result of results) {
      if (!result.qualified) {
        expect(result.rttScore).toBeNull();
        continue;
      }

      expect(result.rttScore).not.toBeNull();
      expect(result.rttScore!).toBeGreaterThanOrEqual(0);
      expect(result.rttScore!).toBeLessThanOrEqual(100);
      expect(result.classification).not.toBeNull();
      expect(result.emaStackScore.score).toBeGreaterThanOrEqual(0);
      expect(result.priceVsEmaScore.score).toBeGreaterThanOrEqual(0);
      expect(result.momentumScore.score).toBeGreaterThanOrEqual(0);
      expect(result.volumeScore.score).toBeGreaterThanOrEqual(0);
      expect(result.sectorScore.score).toBeGreaterThanOrEqual(0);
      expect(result.highProximityScore.score).toBeGreaterThanOrEqual(0);
      expect(result.extensionScore.score).toBeGreaterThanOrEqual(0);
    }
  });

  it("rejection reasons line up with the intended synthetic scenarios", () => {
    const stockByScenario = new Map(DEVELOPMENT_MARKET_STOCKS.map((stock) => [stock.scenario, stock]));

    const misaligned = calculateRttScore(toRttScoreInput(stockByScenario.get("EMA_MISALIGNED")!));
    const rsiLow = calculateRttScore(toRttScoreInput(stockByScenario.get("RSI_LOW")!));
    const rsiHigh = calculateRttScore(toRttScoreInput(stockByScenario.get("RSI_HIGH")!));

    expect(misaligned.rejectionReason).toBe("EMA_ALIGNMENT_FAILED");
    expect(rsiLow.rejectionReason).toBe("RSI_OUT_OF_RANGE");
    expect(rsiHigh.rejectionReason).toBe("RSI_OUT_OF_RANGE");
  });

  it("keeps internal identifiers unique and unchanged", () => {
    const symbols = DEVELOPMENT_MARKET_STOCKS.map((stock) => stock.symbol);
    expect(new Set(symbols).size).toBe(symbols.length);
    expect(symbols.every((symbol) => symbol.startsWith("DEV"))).toBe(true);
  });

  it("exposes a clean, unique display symbol with no DEV prefix", () => {
    const displaySymbols = DEVELOPMENT_MARKET_STOCKS.map((stock) => stock.displaySymbol);

    expect(new Set(displaySymbols).size).toBe(displaySymbols.length);
    for (const stock of DEVELOPMENT_MARKET_STOCKS) {
      expect(stock.displaySymbol.startsWith("DEV")).toBe(false);
      expect(stock.displaySymbol).not.toContain("DEV");
    }
  });

  it("does not derive the display symbol by stripping DEV off the internal symbol", () => {
    for (const stock of DEVELOPMENT_MARKET_STOCKS) {
      // Stripping "DEV" off symbols like DEVHAL/DEVTCS would reveal real NSE
      // tickers (HAL, TCS) that this synthetic data does not represent.
      expect(stock.displaySymbol).not.toBe(stock.symbol.replace(/^DEV/, ""));
    }
  });
});
