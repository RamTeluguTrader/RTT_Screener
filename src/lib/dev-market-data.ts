import {
  calculateSectorStrengths,
  type RttScoreInput,
  type SectorStrength,
} from "./rtt-score";
import { calculateStandardEmas, getLatestEmaValues, type Candle, type EmaValues } from "./technical-analysis";

/** Development-only synthetic data. It is never live market or NSE data. */
export const IS_DEVELOPMENT_DATA = true;
export const DEVELOPMENT_DATA_NOTICE = "Synthetic development-only market data; not live or real NSE data.";

export type DevelopmentScenario =
  | "STRONG"
  | "MODERATE"
  | "WEAK"
  | "EMA_MISALIGNED"
  | "RSI_LOW"
  | "RSI_HIGH"
  | "RSI_50"
  | "RSI_75";

export type DevelopmentMarketStock = {
  /** Internal, stable dataset identifier (e.g. "DEVHAL"). Used for routing, keys, and RTT engine input — never rendered to users. */
  symbol: string;
  /** Clean, user-facing symbol (e.g. "DEFE01"). Derived from the sector, not from `symbol`, so it can never coincide with a real NSE ticker. */
  displaySymbol: string;
  companyName: string;
  sector: string;
  scenario: DevelopmentScenario;
  currentPrice: number;
  high52Week: number;
  rsi14: number;
  volume: number;
  averageVolume20d: number;
  emaValues: EmaValues;
  candles: readonly Candle[];
};

export type ScenarioSettings = {
  growthRate: number;
  recentGrowthRate: number;
  rsi14: number;
  relativeVolume: number;
  highMultiplier: number;
};

const SECTORS = [
  { name: "Defence", symbols: ["DEVHAL", "DEVBEL", "DEVMDSL", "DEVBDL", "DEVASTRA", "DEVPARA"] },
  { name: "Power", symbols: ["DEVNTPC", "DEVPOWERGRID", "DEVTATAPOWER", "DEVSJVN", "DEVNHPC", "DEVTORRENT"] },
  { name: "IT", symbols: ["DEVTCS", "DEVINFY", "DEVHCLTECH", "DEVWIPRO", "DEVTECHM", "DEVPERSISTENT"] },
  { name: "Banking", symbols: ["DEVHDFCBANK", "DEVICICIBANK", "DEVSBIN", "DEVAXISBANK", "DEVKOTAKBANK", "DEVINDUSINDBK"] },
  { name: "Financial Services", symbols: ["DEVBAJFINANCE", "DEVBAJAJFINSV", "DEVSHRIRAMFIN", "DEVCHOLAFIN", "DEVMUTHOOTFIN", "DEVLICHSGFIN"] },
  { name: "Auto", symbols: ["DEVTATAMOTORS", "DEVMARUTI", "DEVM&M", "DEVEICHERMOT", "DEVTVSMOTOR", "DEVBOSCHLTD"] },
  { name: "Pharmaceuticals", symbols: ["DEVSUNPHARMA", "DEVDIVISLAB", "DEVDRREDDY", "DEVCIPLA", "DEVLUPIN", "DEVAUROPHARMA"] },
  { name: "FMCG", symbols: ["DEVITC", "DEVHINDUNILVR", "DEVBRITANNIA", "DEVNESTLEIND", "DEVDABUR", "DEVGODREJCP"] },
  { name: "Industrials", symbols: ["DEVLT", "DEVSIEMENS", "DEVABB", "DEVCUMMINSIND", "DEVTHERMAX", "DEVVOLTAS"] },
  { name: "Energy", symbols: ["DEVRELIANCE", "DEVONGC", "DEVIEX", "DEVGAIL", "DEVBPCL", "DEVIOC"] },
] as const;

const BASE_SCENARIOS: readonly DevelopmentScenario[] = ["STRONG", "MODERATE", "WEAK", "EMA_MISALIGNED", "RSI_LOW", "RSI_HIGH"];

export const SCENARIO_SETTINGS: Record<DevelopmentScenario, ScenarioSettings> = {
  STRONG: { growthRate: 0.007, recentGrowthRate: 0.007, rsi14: 68, relativeVolume: 2, highMultiplier: 1.01 },
  MODERATE: { growthRate: 0.003, recentGrowthRate: 0.003, rsi14: 60, relativeVolume: 1.25, highMultiplier: 1.08 },
  WEAK: { growthRate: 0.006, recentGrowthRate: -0.001, rsi14: 55, relativeVolume: 0.7, highMultiplier: 1.35 },
  EMA_MISALIGNED: { growthRate: -0.0015, recentGrowthRate: -0.0015, rsi14: 60, relativeVolume: 1, highMultiplier: 1.2 },
  RSI_LOW: { growthRate: 0.004, recentGrowthRate: 0.004, rsi14: 45, relativeVolume: 1.5, highMultiplier: 1.04 },
  RSI_HIGH: { growthRate: 0.005, recentGrowthRate: 0.005, rsi14: 78, relativeVolume: 1.5, highMultiplier: 1.03 },
  RSI_50: { growthRate: 0.007, recentGrowthRate: 0.007, rsi14: 50, relativeVolume: 2, highMultiplier: 1.01 },
  RSI_75: { growthRate: 0.007, recentGrowthRate: 0.007, rsi14: 75, relativeVolume: 2, highMultiplier: 1.01 },
};

function scenarioFor(sectorIndex: number, scenario: DevelopmentScenario): DevelopmentScenario {
  if (scenario === "STRONG" && sectorIndex === 0) return "RSI_50";
  if (scenario === "STRONG" && sectorIndex === 1) return "RSI_75";
  return scenario;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Builds a clean, user-facing symbol from the sector name and the stock's
 * position within it (e.g. "Defence" #1 -> "DEFE01"). Deliberately does NOT
 * derive from the internal `symbol` (e.g. "DEVHAL") — stripping a "DEV"
 * prefix off symbols like DEVHAL/DEVTCS would reveal real NSE tickers
 * (HAL, TCS) that this synthetic data does not represent.
 */
function displaySymbolFor(sector: string, indexInSector: number): string {
  const sectorCode = sector.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 4);
  const suffix = String(indexInSector + 1).padStart(2, "0");
  return `${sectorCode}${suffix}`;
}

function createCandles(basePrice: number, settings: ScenarioSettings, seed: number): Candle[] {
  const candleCount = 220;
  const transitionIndex = candleCount - 25;
  const candles = Array.from({ length: candleCount }, (_, index) => {
    const historicalGrowth = index <= transitionIndex
      ? 1
      : (1 + settings.growthRate) ** transitionIndex;
    const recentGrowth = index <= transitionIndex
      ? (1 + settings.growthRate) ** index
      : (1 + settings.recentGrowthRate) ** (index - transitionIndex);
    const variation = 1 + Math.sin(index * 0.47 + seed) * 0.004 + Math.cos(index * 0.19 + seed) * 0.002;
    const close = round(basePrice * historicalGrowth * recentGrowth * variation);
    const volume = Math.round(100_000 * (1 + Math.sin(index * 0.31 + seed) * 0.06));

    return {
      timestamp: Date.UTC(2025, 0, 1 + index),
      open: round(close * (1 - 0.003)),
      high: round(close * (1 + 0.008)),
      low: round(close * (1 - 0.01)),
      close,
      volume,
    };
  });

  const averageVolume20d = candles.slice(-21, -1).reduce((total, candle) => total + candle.volume, 0) / 20;
  const latest = candles.at(-1)!;
  candles[candles.length - 1] = { ...latest, volume: Math.round(averageVolume20d * settings.relativeVolume) };
  return candles;
}

function createStock(symbol: string, sector: string, sectorIndex: number, scenarioIndex: number): DevelopmentMarketStock {
  const scenario = scenarioFor(sectorIndex, BASE_SCENARIOS[scenarioIndex]!);
  const settings = SCENARIO_SETTINGS[scenario];
  const candles = createCandles(65 + sectorIndex * 18 + scenarioIndex * 7, settings, sectorIndex * 10 + scenarioIndex);
  const currentPrice = candles.at(-1)!.close;
  const averageVolume20d = candles.slice(-21, -1).reduce((total, candle) => total + candle.volume, 0) / 20;

  return {
    symbol,
    displaySymbol: displaySymbolFor(sector, scenarioIndex),
    companyName: `Synthetic ${sector} ${scenarioIndex + 1}`,
    sector,
    scenario,
    currentPrice,
    high52Week: round(currentPrice * settings.highMultiplier),
    rsi14: settings.rsi14,
    volume: candles.at(-1)!.volume,
    averageVolume20d: round(averageVolume20d),
    emaValues: getLatestEmaValues(calculateStandardEmas(candles)),
    candles,
  };
}

export const DEVELOPMENT_MARKET_STOCKS: readonly DevelopmentMarketStock[] = SECTORS.flatMap((sector, sectorIndex) =>
  sector.symbols.map((symbol, scenarioIndex) => createStock(symbol, sector.name, sectorIndex, scenarioIndex)),
);

export const DEVELOPMENT_SECTOR_STRENGTHS: readonly SectorStrength[] = calculateSectorStrengths(
  SECTORS.map((sector) => ({
    sector: sector.name,
    members: DEVELOPMENT_MARKET_STOCKS.filter((stock) => stock.sector === sector.name).map((stock) => ({ symbol: stock.symbol, candles: stock.candles })),
  })),
);

const SECTOR_STRENGTH_BY_NAME = new Map(DEVELOPMENT_SECTOR_STRENGTHS.map((strength) => [strength.sector, strength]));

/**
 * Exposes the exact same deterministic candle generator used to build
 * DEVELOPMENT_MARKET_STOCKS (unmodified), so benchmark/perf tooling can
 * synthesize larger datasets without duplicating the generation logic.
 */
export function generateSyntheticCandles(basePrice: number, scenario: DevelopmentScenario, seed: number): Candle[] {
  return createCandles(basePrice, SCENARIO_SETTINGS[scenario], seed);
}

export function toRttScoreInput(stock: DevelopmentMarketStock): RttScoreInput {
  return {
    symbol: stock.symbol,
    candles: stock.candles,
    rsi14: stock.rsi14,
    high52Week: stock.high52Week,
    sectorStrength: SECTOR_STRENGTH_BY_NAME.get(stock.sector),
  };
}
