import { calculateStandardEmas, getLatestEmaValues, type Candle, type EmaValues } from "./technical-analysis";
import { calculateRttScore } from "./rtt-score";
import { DEVELOPMENT_MARKET_STOCKS, toRttScoreInput, type DevelopmentMarketStock } from "./dev-market-data";

export type DetailComponentScore = {
  label: string;
  score: number | null;
  maximum: number;
  explanation: string;
};

export type StockDetailViewModel = {
  symbol: string;
  companyName: string;
  sector: string;
  currentPrice: number | null;
  rttScore: number | null;
  classification: string | null;
  qualified: boolean;
  qualificationReason: string;
  rsi14: number | null;
  ema10: number | null;
  ema20: number | null;
  ema50: number | null;
  ema100: number | null;
  ema200: number | null;
  emaAligned: boolean;
  momentum20d: number | null;
  rvol: number | null;
  high52Week: number | null;
  distanceFrom52WeekHigh: number | null;
  extensionFromEma20: number | null;
  componentScores: DetailComponentScore[];
  qualitativeExplanations: Record<string, string>;
  candles: readonly Candle[];
  isDevelopmentData: boolean;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function sanitizeNumber(value: unknown): number | null {
  return isFiniteNumber(value) ? value : null;
}

const COMPONENT_EXPLANATIONS = {
  "EMA Stack Quality": "Strong trend alignment and healthy EMA structure.",
  "Price vs EMA Structure": "Price structure remains favorably positioned relative to the trend.",
  Momentum: "Recent price momentum is supporting the setup.",
  Volume: "Volume participation is supporting the move.",
  Sector: "Sector participation is favorable.",
  "52W High Proximity": "Price is trading favorably within its 52-week range.",
  Extension: "Price remains reasonably positioned relative to the trend.",
} as const;

export function buildStockDetailViewModelFromStock(stock: DevelopmentMarketStock | null | undefined): StockDetailViewModel | null {
  if (!stock) return null;

  const scoreResult = calculateRttScore(toRttScoreInput(stock));
  let emaValues: EmaValues = {
    ema10: null,
    ema20: null,
    ema50: null,
    ema100: null,
    ema200: null,
  };

  try {
    emaValues = getLatestEmaValues(calculateStandardEmas(stock.candles));
  } catch {
    // Fall back to null EMA values for malformed or partial datasets.
  }

  const componentScores: DetailComponentScore[] = [
    { label: "EMA Stack Quality", score: scoreResult.emaStackScore.score, maximum: scoreResult.emaStackScore.maximum, explanation: COMPONENT_EXPLANATIONS["EMA Stack Quality"] },
    { label: "Price vs EMA Structure", score: scoreResult.priceVsEmaScore.score, maximum: scoreResult.priceVsEmaScore.maximum, explanation: COMPONENT_EXPLANATIONS["Price vs EMA Structure"] },
    { label: "Momentum", score: scoreResult.momentumScore.score, maximum: scoreResult.momentumScore.maximum, explanation: COMPONENT_EXPLANATIONS.Momentum },
    { label: "Volume", score: scoreResult.volumeScore.score, maximum: scoreResult.volumeScore.maximum, explanation: COMPONENT_EXPLANATIONS.Volume },
    { label: "Sector", score: scoreResult.sectorScore.score, maximum: scoreResult.sectorScore.maximum, explanation: COMPONENT_EXPLANATIONS.Sector },
    { label: "52W High Proximity", score: scoreResult.highProximityScore.score, maximum: scoreResult.highProximityScore.maximum, explanation: COMPONENT_EXPLANATIONS["52W High Proximity"] },
    { label: "Extension", score: scoreResult.extensionScore.score, maximum: scoreResult.extensionScore.maximum, explanation: COMPONENT_EXPLANATIONS.Extension },
  ];

  return {
    symbol: stock.symbol,
    companyName: stock.companyName,
    sector: stock.sector,
    currentPrice: sanitizeNumber(stock.currentPrice),
    rttScore: scoreResult.rttScore,
    classification: scoreResult.classification,
    qualified: scoreResult.qualified,
    qualificationReason: scoreResult.rejectionReason ?? "Qualified by RTT criteria",
    rsi14: sanitizeNumber(scoreResult.rsi),
    ema10: sanitizeNumber(emaValues.ema10),
    ema20: sanitizeNumber(emaValues.ema20),
    ema50: sanitizeNumber(emaValues.ema50),
    ema100: sanitizeNumber(emaValues.ema100),
    ema200: sanitizeNumber(emaValues.ema200),
    emaAligned: scoreResult.qualified && emaValues.ema10 !== null && emaValues.ema20 !== null && emaValues.ema50 !== null && emaValues.ema100 !== null && emaValues.ema200 !== null && emaValues.ema10 > emaValues.ema20 && emaValues.ema20 > emaValues.ema50 && emaValues.ema50 > emaValues.ema100 && emaValues.ema100 > emaValues.ema200,
    momentum20d: sanitizeNumber(scoreResult.momentum20d),
    rvol: sanitizeNumber(scoreResult.rvol),
    high52Week: sanitizeNumber(stock.high52Week),
    distanceFrom52WeekHigh: sanitizeNumber(scoreResult.distanceFrom52WeekHigh),
    extensionFromEma20: sanitizeNumber(scoreResult.extensionFromEma20),
    componentScores,
    qualitativeExplanations: Object.fromEntries(componentScores.map((component) => [component.label, component.explanation])),
    candles: Array.isArray(stock.candles) ? stock.candles : [],
    isDevelopmentData: true,
  };
}

export function buildStockDetailViewModel(symbol: string): StockDetailViewModel | null {
  const stock = DEVELOPMENT_MARKET_STOCKS.find((candidate) => candidate.symbol === symbol);
  return buildStockDetailViewModelFromStock(stock);
}
