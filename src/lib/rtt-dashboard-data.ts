import { DEVELOPMENT_MARKET_STOCKS, toRttScoreInput } from "./dev-market-data";
import { calculateRttScore, type RttScoreResult } from "./rtt-score";

export type DashboardComponentScore = {
  label: string;
  score: number | null;
  maximum: number;
  explanation: string;
};

export type RttDashboardRow = {
  symbol: string;
  companyName: string;
  sector: string;
  currentPrice: number;
  rsi: number | null;
  rttScore: number | null;
  classification: string | null;
  qualified: boolean;
  emaStatus: string;
  momentum: number | null;
  volume: number | null;
  componentScores: DashboardComponentScore[];
  qualitativeSignals: string[];
  rank: number;
};

export type RttDashboardData = {
  totalStocks: number;
  qualifiedRows: RttDashboardRow[];
  rejectedRows: RttDashboardRow[];
};

const COMPONENT_LABELS = [
  { label: "EMA Stack Quality", explanation: "Strong trend alignment and healthy EMA structure." },
  { label: "Momentum", explanation: "Strong recent price momentum." },
  { label: "Volume", explanation: "Volume participation is supporting the current move." },
  { label: "Sector", explanation: "Sector participation is favorable." },
  { label: "52W High Proximity", explanation: "Price is trading favorably relative to its 52-week range." },
  { label: "Extension", explanation: "Price structure remains reasonably positioned relative to the trend." },
] as const;

function mapComponentScores(result: RttScoreResult): DashboardComponentScore[] {
  return [
    { label: "EMA Stack Quality", score: result.emaStackScore.score, maximum: result.emaStackScore.maximum, explanation: COMPONENT_LABELS[0]!.explanation },
    { label: "Momentum", score: result.momentumScore.score, maximum: result.momentumScore.maximum, explanation: COMPONENT_LABELS[1]!.explanation },
    { label: "Volume", score: result.volumeScore.score, maximum: result.volumeScore.maximum, explanation: COMPONENT_LABELS[2]!.explanation },
    { label: "Sector", score: result.sectorScore.score, maximum: result.sectorScore.maximum, explanation: COMPONENT_LABELS[3]!.explanation },
    { label: "52W High Proximity", score: result.highProximityScore.score, maximum: result.highProximityScore.maximum, explanation: COMPONENT_LABELS[4]!.explanation },
    { label: "Extension", score: result.extensionScore.score, maximum: result.extensionScore.maximum, explanation: COMPONENT_LABELS[5]!.explanation },
  ];
}

function makeQualitativeSignals(result: RttScoreResult): string[] {
  const signals: string[] = [];
  if (result.qualified) signals.push("RTT Qualified ✓");
  if (result.rttScore !== null && result.rttScore >= 80) signals.push("High-quality setup");
  if (result.momentum20d !== null && result.momentum20d > 0) signals.push("Positive momentum");
  if (result.rvol !== null && result.rvol >= 1.25) signals.push("Volume participation is strong");
  if (result.distanceFrom52WeekHigh !== null && result.distanceFrom52WeekHigh <= 10) signals.push("Near 52-week high");
  return signals;
}

function buildEmaStatus(result: RttScoreResult): string {
  return result.qualified ? "Aligned" : "Not qualified";
}

export function buildRttDashboardData(limit = 20): RttDashboardData {
  const rows = DEVELOPMENT_MARKET_STOCKS.map((stock) => {
    const result = calculateRttScore(toRttScoreInput(stock));
    return {
      symbol: stock.symbol,
      companyName: stock.companyName,
      sector: stock.sector,
      currentPrice: stock.currentPrice,
      rsi: result.rsi,
      rttScore: result.rttScore,
      classification: result.classification,
      qualified: result.qualified,
      emaStatus: buildEmaStatus(result),
      momentum: result.momentum20d,
      volume: result.rvol,
      componentScores: mapComponentScores(result),
      qualitativeSignals: makeQualitativeSignals(result),
      rank: 0,
    } satisfies RttDashboardRow;
  }).filter((row) => row.qualified);

  const qualifiedRows = rows
    .slice()
    .sort((left, right) => {
      const scoreDelta = (right.rttScore ?? -1) - (left.rttScore ?? -1);
      if (scoreDelta !== 0) return scoreDelta;
      return left.symbol.localeCompare(right.symbol);
    })
    .slice(0, limit)
    .map((row, index) => ({ ...row, rank: index + 1 }));

  const rejectedRows = DEVELOPMENT_MARKET_STOCKS.map((stock) => {
    const result = calculateRttScore(toRttScoreInput(stock));
    return {
      symbol: stock.symbol,
      companyName: stock.companyName,
      sector: stock.sector,
      currentPrice: stock.currentPrice,
      rsi: result.rsi,
      rttScore: result.rttScore,
      classification: result.classification,
      qualified: result.qualified,
      emaStatus: buildEmaStatus(result),
      momentum: result.momentum20d,
      volume: result.rvol,
      componentScores: mapComponentScores(result),
      qualitativeSignals: makeQualitativeSignals(result),
      rank: 0,
    } satisfies RttDashboardRow;
  }).filter((row) => !row.qualified);

  return { totalStocks: DEVELOPMENT_MARKET_STOCKS.length, qualifiedRows, rejectedRows };
}
