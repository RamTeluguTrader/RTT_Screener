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

/**
 * In-flight de-duplication: concurrent callers for the same instrument share
 * one real network request instead of each firing their own. The completed-
 * result cache above only helps once a request has *finished* — without
 * this, two components mounting in the same render pass (e.g. SummaryCards
 * and ScreenerTable both loading the full universe on the Dashboard) would
 * each independently fetch every symbol, roughly doubling real Upstox
 * traffic and making a 429 far more likely.
 */
const pendingRequests = new Map<string, Promise<FetchCandlesResult>>();

export type FetchCandlesResult = { ok: true; candles: Candle[] } | { ok: false; error: string };

const RATE_LIMIT_MAX_RETRIES = 2;
const RATE_LIMIT_BASE_DELAY_MS = 750;

function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

/** The actual network call, with retry-with-backoff specifically on 429 (rate limited). */
async function fetchCandlesOnce(instrumentKey: string): Promise<FetchCandlesResult> {
  const to = new Date();
  const from = new Date(to.getTime() - HISTORY_DAYS * 24 * 60 * 60 * 1000);
  const url = `/api/upstox/candles?key=${encodeURIComponent(instrumentKey)}&from=${toDateStr(from)}&to=${toDateStr(to)}`;

  for (let attempt = 0; attempt <= RATE_LIMIT_MAX_RETRIES; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(url);
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Network error while contacting the data proxy." };
    }

    if (response.status === 429 && attempt < RATE_LIMIT_MAX_RETRIES) {
      const retryAfterSeconds = Number(response.headers.get("Retry-After"));
      const delayMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0 ? retryAfterSeconds * 1000 : RATE_LIMIT_BASE_DELAY_MS * 2 ** attempt;
      await sleep(delayMs);
      continue;
    }

    if (response.status === 429) {
      return { ok: false, error: "Upstox is temporarily rate-limiting requests. Please try again shortly." };
    }

    const body = (await response.json().catch(() => null)) as { candles?: Candle[]; error?: string } | null;
    if (!response.ok) {
      return { ok: false, error: body?.error ?? `Request failed (${response.status}).` };
    }
    const candles = Array.isArray(body?.candles) ? body.candles : [];
    memoryCache.set(instrumentKey, { fetchedAt: Date.now(), candles });
    return { ok: true, candles };
  }

  // Unreachable in practice (the loop always returns), but keeps the function total.
  return { ok: false, error: "Upstox is temporarily rate-limiting requests. Please try again shortly." };
}

export async function fetchCandlesForInstrument(instrumentKey: string, options?: { forceRefresh?: boolean }): Promise<FetchCandlesResult> {
  const cached = memoryCache.get(instrumentKey);
  if (!options?.forceRefresh && cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return { ok: true, candles: cached.candles };
  }

  const pending = pendingRequests.get(instrumentKey);
  if (pending) return pending;

  const request = fetchCandlesOnce(instrumentKey).finally(() => {
    pendingRequests.delete(instrumentKey);
  });
  pendingRequests.set(instrumentKey, request);
  return request;
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
