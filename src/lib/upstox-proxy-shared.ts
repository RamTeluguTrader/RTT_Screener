import type { Candle } from "./technical-analysis.ts";

/**
 * Runtime-agnostic helpers shared between the local Vite dev-server proxy
 * (vite.config.ts) and the Vercel Edge Functions (api/upstox/*.ts). Both
 * environments support the standard fetch/URL APIs this relies on, so
 * candle-fetching and -parsing behavior is identical in dev and prod. Never
 * import Node-only APIs here.
 */

const UPSTOX_CANDLE_BASE = "https://api.upstox.com/v3/historical-candle";

export type RawUpstoxCandle = [string, number, number, number, number, number, number?];

export function buildUpstoxCandleUrl(instrumentKey: string, from: string, to: string): string {
  return `${UPSTOX_CANDLE_BASE}/${encodeURIComponent(instrumentKey)}/days/1/${to}/${from}`;
}

export function parseUpstoxCandlesBody(body: { data?: { candles?: RawUpstoxCandle[] } }): Candle[] {
  const rawCandles = Array.isArray(body.data?.candles) ? body.data.candles : [];
  return rawCandles
    .map((row) => ({
      timestamp: new Date(row[0]).getTime(),
      open: row[1],
      high: row[2],
      low: row[3],
      close: row[4],
      volume: row[5],
    }))
    .sort((a, b) => a.timestamp - b.timestamp);
}
