import type { Candle } from "./technical-analysis";

/**
 * Client-side data-acquisition layer. Talks only to the same-origin
 * /api/upstox/* proxy (see vite.config.ts) — the Upstox access token never
 * reaches the browser. This module owns fetching + caching raw candles;
 * technical calculations and RTT scoring happen downstream in
 * rtt2x-live-data.ts, so a single fetch per stock is enough for every RTT
 * component.
 */

const CACHE_TTL_MS = 15 * 60 * 1000;
// Wide enough to comfortably clear EMA200 (~200 sessions) plus the 10/30/60-session
// resilience and slope lookbacks used by RTT 2.X, with margin for holidays/weekends.
const HISTORY_DAYS = 500;

type CacheEntry = { fetchedAt: number; candles: Candle[] };
const memoryCache = new Map<string, CacheEntry>();

export type FetchCandlesResult = { ok: true; candles: Candle[] } | { ok: false; error: string };

function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function fetchUpstoxStatus(): Promise<{ configured: boolean }> {
  try {
    const response = await fetch("/api/upstox/status");
    if (!response.ok) return { configured: false };
    return (await response.json()) as { configured: boolean };
  } catch {
    return { configured: false };
  }
}

export async function fetchCandlesForInstrument(instrumentKey: string, options?: { forceRefresh?: boolean }): Promise<FetchCandlesResult> {
  const cached = memoryCache.get(instrumentKey);
  if (!options?.forceRefresh && cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return { ok: true, candles: cached.candles };
  }

  const to = new Date();
  const from = new Date(to.getTime() - HISTORY_DAYS * 24 * 60 * 60 * 1000);
  const url = `/api/upstox/candles?key=${encodeURIComponent(instrumentKey)}&from=${toDateStr(from)}&to=${toDateStr(to)}`;

  try {
    const response = await fetch(url);
    const body = (await response.json().catch(() => null)) as { candles?: Candle[]; error?: string } | null;
    if (!response.ok) {
      return { ok: false, error: body?.error ?? `Request failed (${response.status}).` };
    }
    const candles = Array.isArray(body?.candles) ? body.candles : [];
    memoryCache.set(instrumentKey, { fetchedAt: Date.now(), candles });
    return { ok: true, candles };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Network error while contacting the data proxy." };
  }
}

/** Runs async work over `items` with bounded concurrency, preserving input order in the results. */
export async function mapWithConcurrency<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await fn(items[index]!);
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
  return results;
}
