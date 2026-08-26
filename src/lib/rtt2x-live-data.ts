import { RTT2X_UNIVERSE, findUniverseStock, type UniverseStock } from "./rtt2x-universe";
import { fetchCandlesForInstrument, mapWithConcurrency } from "./upstox-client";
import { calculateRtt2xScore, type Rtt2xScoreResult } from "./rtt2x-score";
import { calculateSectorStrengths, type SectorMembers, type SectorStrength } from "./rtt-score";
import { calculateStandardEmas, getLatestEmaValues, type Candle } from "./technical-analysis";

/**
 * Orchestrates the real-data pipeline:
 *   Upstox (via the dev-server proxy) -> Candle[] -> technical-analysis.ts
 *   -> RTT 2.X -> qualification -> score -> (this module ranks/filters) -> UI.
 * No synthetic data, no hardcoded scores. Sector strength is computed here
 * from the same live candles and attached as context only — it is never
 * used to alter ranking (see rtt2x-score.ts, which never adds it to rttScore).
 */

export type Rtt2xLiveRow = {
  symbol: string;
  companyName: string;
  sector: string;
  currentPrice: number | null;
  candles: Candle[];
  result: Rtt2xScoreResult;
  ema20: number | null;
  ema50: number | null;
  distanceFromEma20: number | null;
  distanceFromEma50: number | null;
};

export type FailedSymbol = { symbol: string; error: string };

export type Rtt2xUniverseData = {
  rows: Rtt2xLiveRow[];
  failedSymbols: FailedSymbol[];
  fetchedAt: number;
};

const FETCH_CONCURRENCY = 6;

function buildSectorStrengths(candlesBySymbol: Map<string, Candle[]>): Map<string, SectorStrength> {
  const bySector = new Map<string, { symbol: string; candles: Candle[] }[]>();
  for (const stock of RTT2X_UNIVERSE) {
    const candles = candlesBySymbol.get(stock.symbol);
    if (!candles || candles.length === 0) continue;
    if (!bySector.has(stock.sector)) bySector.set(stock.sector, []);
    bySector.get(stock.sector)!.push({ symbol: stock.symbol, candles });
  }
  const sectors: SectorMembers[] = Array.from(bySector.entries()).map(([sector, members]) => ({ sector, members }));
  const strengths = calculateSectorStrengths(sectors);
  return new Map(strengths.map((s) => [s.sector, s]));
}

function buildRow(stock: UniverseStock, candles: Candle[], sectorStrength: SectorStrength | undefined): Rtt2xLiveRow {
  const result = calculateRtt2xScore({ symbol: stock.symbol, candles, sectorStrength });

  let ema20: number | null = null;
  let ema50: number | null = null;
  try {
    const emaValues = getLatestEmaValues(calculateStandardEmas(candles));
    ema20 = emaValues.ema20;
    ema50 = emaValues.ema50;
  } catch {
    // Leave EMAs null for malformed candle data; the score result already
    // reflects INVALID_DATA/INSUFFICIENT_DATA and the row still renders safely.
  }

  const currentPrice = candles.at(-1)?.close ?? null;

  return {
    symbol: stock.symbol,
    companyName: stock.companyName,
    sector: stock.sector,
    currentPrice,
    candles,
    result,
    ema20,
    ema50,
    distanceFromEma20: currentPrice !== null && ema20 !== null && ema20 > 0 ? ((currentPrice - ema20) / ema20) * 100 : null,
    distanceFromEma50: currentPrice !== null && ema50 !== null && ema50 > 0 ? ((currentPrice - ema50) / ema50) * 100 : null,
  };
}

/**
 * Fetches and scores the full screener universe. A single failed/insufficient
 * symbol is recorded in `failedSymbols` and skipped — it never throws or
 * takes down the rest of the screener.
 */
export async function loadRtt2xUniverse(options?: { forceRefresh?: boolean }): Promise<Rtt2xUniverseData> {
  const failedSymbols: FailedSymbol[] = [];
  const candlesBySymbol = new Map<string, Candle[]>();

  const fetched = await mapWithConcurrency(RTT2X_UNIVERSE, FETCH_CONCURRENCY, async (stock) => {
    const result = await fetchCandlesForInstrument(stock.instrumentKey, { forceRefresh: options?.forceRefresh });
    return { stock, result };
  });

  for (const { stock, result } of fetched) {
    if (!result.ok) {
      failedSymbols.push({ symbol: stock.symbol, error: result.error });
      continue;
    }
    if (result.candles.length === 0) {
      failedSymbols.push({ symbol: stock.symbol, error: "No candle data returned." });
      continue;
    }
    candlesBySymbol.set(stock.symbol, result.candles);
  }

  const sectorStrengthByName = buildSectorStrengths(candlesBySymbol);

  const rows: Rtt2xLiveRow[] = [];
  for (const stock of RTT2X_UNIVERSE) {
    const candles = candlesBySymbol.get(stock.symbol);
    if (!candles) continue;
    try {
      rows.push(buildRow(stock, candles, sectorStrengthByName.get(stock.sector)));
    } catch {
      failedSymbols.push({ symbol: stock.symbol, error: "Scoring failed for this symbol." });
    }
  }

  return { rows, failedSymbols, fetchedAt: Date.now() };
}

export type StockDetailResult = { ok: true; row: Rtt2xLiveRow } | { ok: false; error: string };

/**
 * Fetches just one stock (plus its sector siblings, for sector context only)
 * — used by the stock-detail page so navigating to a single symbol never
 * requires loading the whole universe.
 */
export async function loadRtt2xStockDetail(symbol: string): Promise<StockDetailResult> {
  const stock = findUniverseStock(symbol);
  if (!stock) return { ok: false, error: `"${symbol}" is not in the current screener universe.` };

  const primary = await fetchCandlesForInstrument(stock.instrumentKey);
  if (!primary.ok) return { ok: false, error: primary.error };
  if (primary.candles.length === 0) return { ok: false, error: "No candle data returned for this symbol." };

  const siblings = RTT2X_UNIVERSE.filter((s) => s.sector === stock.sector && s.symbol !== stock.symbol);
  const siblingResults = await mapWithConcurrency(siblings, FETCH_CONCURRENCY, (s) => fetchCandlesForInstrument(s.instrumentKey));

  const candlesBySymbol = new Map<string, Candle[]>([[stock.symbol, primary.candles]]);
  siblings.forEach((s, index) => {
    const result = siblingResults[index]!;
    if (result.ok && result.candles.length > 0) candlesBySymbol.set(s.symbol, result.candles);
  });

  const sectorStrengthByName = buildSectorStrengths(candlesBySymbol);
  return { ok: true, row: buildRow(stock, primary.candles, sectorStrengthByName.get(stock.sector)) };
}
