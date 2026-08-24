import { calculateSectorStrengths, calculateRttScore, type SectorMembers } from "./rtt-score";
import { generateSyntheticCandles, SCENARIO_SETTINGS, type DevelopmentScenario } from "./dev-market-data";
import type { Candle } from "./technical-analysis";

export type RttBenchmarkResult = {
  stockCount: number;
  /** Wall-clock time for sector-strength + qualification + scoring only (excludes synthetic data generation). */
  totalMs: number;
  qualifiedCount: number;
  rejectedCount: number;
  errorCount: number;
  errors: string[];
  /** `process.memoryUsage().heapUsed` delta in bytes, or null where unavailable (e.g. non-Node environments). Noisy without a forced GC — treat as indicative, not precise. */
  heapUsedDeltaBytes: number | null;
};

const SCENARIOS = Object.keys(SCENARIO_SETTINGS) as DevelopmentScenario[];

const SECTOR_NAMES = [
  "Defence",
  "Power",
  "IT",
  "Banking",
  "Financial Services",
  "Auto",
  "Pharmaceuticals",
  "FMCG",
  "Industrials",
  "Energy",
] as const;

type BenchmarkStock = {
  symbol: string;
  sector: string;
  candles: readonly Candle[];
  rsi14: number;
  high52Week: number;
};

function buildBenchmarkStock(index: number): BenchmarkStock {
  const sector = SECTOR_NAMES[index % SECTOR_NAMES.length]!;
  const scenario = SCENARIOS[index % SCENARIOS.length]!;
  const settings = SCENARIO_SETTINGS[scenario];
  const basePrice = 40 + (index % 400) * 1.3;
  const candles = generateSyntheticCandles(basePrice, scenario, index);
  const currentPrice = candles.at(-1)!.close;

  return {
    symbol: `BENCH${String(index).padStart(5, "0")}`,
    sector,
    candles,
    rsi14: settings.rsi14,
    high52Week: Math.round(currentPrice * settings.highMultiplier * 100) / 100,
  };
}

type NodeProcessLike = { memoryUsage?: () => { heapUsed: number } };

function readHeapUsedBytes(): number | null {
  // Referenced via globalThis (rather than the bare `process` identifier) so this
  // file type-checks under the app's browser-only tsconfig; still reads the real
  // Node process object at runtime when this benchmark is run under Node/Vitest.
  const proc = (globalThis as { process?: NodeProcessLike }).process;
  return typeof proc?.memoryUsage === "function" ? proc.memoryUsage().heapUsed : null;
}

/**
 * Runs the existing, unmodified RTT pipeline (technical-analysis EMAs,
 * qualification, scoring, sector-strength) over `stockCount` deterministic
 * synthetic stocks and measures it. For benchmarking only — this module is
 * never imported by any route or UI component, so it never runs as part of
 * normal app usage.
 */
export function runRttBenchmark(stockCount: number): RttBenchmarkResult {
  const stocks = Array.from({ length: stockCount }, (_, index) => buildBenchmarkStock(index));

  const sectorGroups = new Map<string, { symbol: string; candles: readonly Candle[] }[]>();
  for (const stock of stocks) {
    const members = sectorGroups.get(stock.sector) ?? [];
    members.push({ symbol: stock.symbol, candles: stock.candles });
    sectorGroups.set(stock.sector, members);
  }
  const sectorMembers: SectorMembers[] = Array.from(sectorGroups.entries()).map(([sector, members]) => ({
    sector,
    members,
  }));

  const heapBefore = readHeapUsedBytes();
  const started = performance.now();

  const errors: string[] = [];
  let qualifiedCount = 0;
  let rejectedCount = 0;

  const sectorStrengths = calculateSectorStrengths(sectorMembers);
  const sectorStrengthByName = new Map(sectorStrengths.map((strength) => [strength.sector, strength]));

  for (const stock of stocks) {
    try {
      const result = calculateRttScore({
        symbol: stock.symbol,
        candles: stock.candles,
        rsi14: stock.rsi14,
        high52Week: stock.high52Week,
        sectorStrength: sectorStrengthByName.get(stock.sector),
      });
      if (result.qualified) {
        qualifiedCount += 1;
      } else {
        rejectedCount += 1;
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  const totalMs = performance.now() - started;
  const heapAfter = readHeapUsedBytes();

  return {
    stockCount,
    totalMs,
    qualifiedCount,
    rejectedCount,
    errorCount: errors.length,
    errors,
    heapUsedDeltaBytes: heapBefore !== null && heapAfter !== null ? heapAfter - heapBefore : null,
  };
}
