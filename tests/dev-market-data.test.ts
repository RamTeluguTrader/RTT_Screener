import { describe, expect, it } from "vitest";

import {
  DEVELOPMENT_DATA_NOTICE,
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

  it("uses real, unique, non-DEV-prefixed NSE symbols as the internal identifier", () => {
    const symbols = DEVELOPMENT_MARKET_STOCKS.map((stock) => stock.symbol);

    expect(new Set(symbols).size).toBe(symbols.length);
    for (const symbol of symbols) {
      expect(symbol.startsWith("DEV")).toBe(false);
    }
    // Spot-check a few well-known, verified NSE tickers are present.
    expect(symbols).toEqual(expect.arrayContaining(["HAL", "TCS", "RELIANCE", "HDFCBANK", "ITC"]));
  });

  it("uses the real symbol as the display symbol too (no separate obfuscated display form)", () => {
    for (const stock of DEVELOPMENT_MARKET_STOCKS) {
      expect(stock.displaySymbol).toBe(stock.symbol);
    }
  });

  it("uses real company names, not the old auto-generated 'Synthetic <sector> N' placeholder", () => {
    const companyNames = DEVELOPMENT_MARKET_STOCKS.map((stock) => stock.companyName);

    expect(new Set(companyNames).size).toBe(companyNames.length);
    for (const name of companyNames) {
      expect(name.startsWith("Synthetic")).toBe(false);
    }
    expect(companyNames).toEqual(
      expect.arrayContaining(["Hindustan Aeronautics Ltd", "Tata Consultancy Services Ltd", "Reliance Industries Ltd"]),
    );
  });

  it("still clearly marks the dataset as synthetic/development despite using real company identities", () => {
    expect(IS_DEVELOPMENT_DATA).toBe(true);
    expect(DEVELOPMENT_DATA_NOTICE.toLowerCase()).toContain("synthetic");
    expect(DEVELOPMENT_DATA_NOTICE.toLowerCase()).toContain("not live or real nse data");
  });
});
