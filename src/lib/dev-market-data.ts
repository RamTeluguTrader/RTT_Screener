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
  /**
   * Real, verified NSE equity symbol (e.g. "HAL") used as the internal
   * identifier for routing, keys, and RTT engine input, so a future switch to
   * live data can reuse the same identifiers. The underlying price/RSI/volume/
   * candles/score are still entirely synthetic — see IS_DEVELOPMENT_DATA.
   */
  symbol: string;
  /** Equal to `symbol`. Kept as a distinct field so display code doesn't need to know whether the identifier is "real" — see prior dev-only display-symbol scheme this replaced. */
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

/**
 * Real, verified NSE equity symbols and official company names (checked
 * against the public NSE scrip master) used as the identity/display layer
 * for the synthetic dataset below. Every other field on a development stock
 * — price, RSI, volume, candles, RTT score — remains entirely synthetic;
 * see IS_DEVELOPMENT_DATA / DEVELOPMENT_DATA_NOTICE.
 */
const SECTORS = [
  {
    name: "Defence",
    stocks: [
      { symbol: "HAL", companyName: "Hindustan Aeronautics Ltd" },
      { symbol: "BEL", companyName: "Bharat Electronics Ltd" },
      { symbol: "BDL", companyName: "Bharat Dynamics Ltd" },
      { symbol: "MAZDOCK", companyName: "Mazagon Dock Shipbuilders Ltd" },
      { symbol: "ASTRAMICRO", companyName: "Astra Microwave Products Ltd" },
      { symbol: "PARAS", companyName: "Paras Defence and Space Technologies Ltd" },
    ],
  },
  {
    name: "Power",
    stocks: [
      { symbol: "NTPC", companyName: "NTPC Ltd" },
      { symbol: "POWERGRID", companyName: "Power Grid Corporation of India Ltd" },
      { symbol: "TATAPOWER", companyName: "Tata Power Company Ltd" },
      { symbol: "JSWENERGY", companyName: "JSW Energy Ltd" },
      { symbol: "SJVN", companyName: "SJVN Ltd" },
      { symbol: "NHPC", companyName: "NHPC Ltd" },
    ],
  },
  {
    name: "IT",
    stocks: [
      { symbol: "TCS", companyName: "Tata Consultancy Services Ltd" },
      { symbol: "INFY", companyName: "Infosys Ltd" },
      { symbol: "HCLTECH", companyName: "HCL Technologies Ltd" },
      { symbol: "COFORGE", companyName: "Coforge Ltd" },
      { symbol: "WIPRO", companyName: "Wipro Ltd" },
      { symbol: "TECHM", companyName: "Tech Mahindra Ltd" },
    ],
  },
  {
    name: "Banking",
    stocks: [
      { symbol: "HDFCBANK", companyName: "HDFC Bank Ltd" },
      { symbol: "ICICIBANK", companyName: "ICICI Bank Ltd" },
      { symbol: "SBIN", companyName: "State Bank of India" },
      { symbol: "AXISBANK", companyName: "Axis Bank Ltd" },
      { symbol: "KOTAKBANK", companyName: "Kotak Mahindra Bank Ltd" },
      { symbol: "INDUSINDBK", companyName: "IndusInd Bank Ltd" },
    ],
  },
  {
    name: "Financial Services",
    stocks: [
      { symbol: "BAJFINANCE", companyName: "Bajaj Finance Ltd" },
      { symbol: "BAJAJFINSV", companyName: "Bajaj Finserv Ltd" },
      { symbol: "HDFCLIFE", companyName: "HDFC Life Insurance Company Ltd" },
      { symbol: "SBILIFE", companyName: "SBI Life Insurance Company Ltd" },
      { symbol: "MUTHOOTFIN", companyName: "Muthoot Finance Ltd" },
      { symbol: "CHOLAFIN", companyName: "Cholamandalam Investment and Finance Company Ltd" },
    ],
  },
  {
    name: "Auto",
    stocks: [
      { symbol: "M&M", companyName: "Mahindra & Mahindra Ltd" },
      { symbol: "MARUTI", companyName: "Maruti Suzuki India Ltd" },
      // Tata Motors demerged in 2025; TMCV is the verified successor listing for "Tata Motors Ltd" (commercial vehicles).
      { symbol: "TMCV", companyName: "Tata Motors Ltd" },
      { symbol: "BAJAJ-AUTO", companyName: "Bajaj Auto Ltd" },
      { symbol: "EICHERMOT", companyName: "Eicher Motors Ltd" },
      { symbol: "TVSMOTOR", companyName: "TVS Motor Company Ltd" },
    ],
  },
  {
    name: "Pharmaceuticals",
    stocks: [
      { symbol: "SUNPHARMA", companyName: "Sun Pharmaceutical Industries Ltd" },
      { symbol: "DRREDDY", companyName: "Dr. Reddy's Laboratories Ltd" },
      { symbol: "CIPLA", companyName: "Cipla Ltd" },
      { symbol: "DIVISLAB", companyName: "Divi's Laboratories Ltd" },
      { symbol: "LUPIN", companyName: "Lupin Ltd" },
      { symbol: "AUROPHARMA", companyName: "Aurobindo Pharma Ltd" },
    ],
  },
  {
    name: "FMCG",
    stocks: [
      { symbol: "ITC", companyName: "ITC Ltd" },
      { symbol: "HINDUNILVR", companyName: "Hindustan Unilever Ltd" },
      { symbol: "BRITANNIA", companyName: "Britannia Industries Ltd" },
      { symbol: "NESTLEIND", companyName: "Nestle India Ltd" },
      { symbol: "DABUR", companyName: "Dabur India Ltd" },
      { symbol: "GODREJCP", companyName: "Godrej Consumer Products Ltd" },
    ],
  },
  {
    name: "Industrials",
    stocks: [
      { symbol: "SIEMENS", companyName: "Siemens Ltd" },
      { symbol: "ABB", companyName: "ABB India Ltd" },
      { symbol: "THERMAX", companyName: "Thermax Ltd" },
      { symbol: "CUMMINSIND", companyName: "Cummins India Ltd" },
      { symbol: "LT", companyName: "Larsen & Toubro Ltd" },
      { symbol: "VOLTAS", companyName: "Voltas Ltd" },
    ],
  },
  {
    name: "Energy",
    stocks: [
      { symbol: "RELIANCE", companyName: "Reliance Industries Ltd" },
      { symbol: "ONGC", companyName: "Oil and Natural Gas Corporation Ltd" },
      { symbol: "COALINDIA", companyName: "Coal India Ltd" },
      { symbol: "OIL", companyName: "Oil India Ltd" },
      { symbol: "GAIL", companyName: "GAIL (India) Ltd" },
      { symbol: "BPCL", companyName: "Bharat Petroleum Corporation Ltd" },
    ],
  },
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

function createStock(symbol: string, companyName: string, sector: string, sectorIndex: number, scenarioIndex: number): DevelopmentMarketStock {
  const scenario = scenarioFor(sectorIndex, BASE_SCENARIOS[scenarioIndex]!);
  const settings = SCENARIO_SETTINGS[scenario];
  const candles = createCandles(65 + sectorIndex * 18 + scenarioIndex * 7, settings, sectorIndex * 10 + scenarioIndex);
  const currentPrice = candles.at(-1)!.close;
  const averageVolume20d = candles.slice(-21, -1).reduce((total, candle) => total + candle.volume, 0) / 20;

  return {
    symbol,
    displaySymbol: symbol,
    companyName,
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
  sector.stocks.map((stock, scenarioIndex) => createStock(stock.symbol, stock.companyName, sector.name, sectorIndex, scenarioIndex)),
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
