import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchCandlesForInstrument, fetchUpstoxStatus } from "../src/lib/upstox-client";

/**
 * Each test uses its own unique fake instrument key so the module-level
 * memory cache / in-flight map from one test never leaks into another —
 * avoids needing a test-only reset export on a file that's part of the
 * Upstox data-acquisition layer.
 */
let keyCounter = 0;
function uniqueKey(): string {
  keyCounter += 1;
  return `NSE_EQ|TEST_KEY_${keyCounter}`;
}

function jsonResponse(status: number, body: unknown, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });
}

const sampleCandles = [{ timestamp: 1, open: 1, high: 2, low: 0.5, close: 1.5, volume: 100 }];

describe("fetchCandlesForInstrument — in-flight de-duplication", () => {
  it("shares one real network request across concurrent callers for the same instrument", async () => {
    const key = uniqueKey();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(200, { candles: sampleCandles }));

    const [a, b, c] = await Promise.all([
      fetchCandlesForInstrument(key),
      fetchCandlesForInstrument(key),
      fetchCandlesForInstrument(key),
    ]);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(a).toEqual({ ok: true, candles: sampleCandles });
    expect(b).toEqual(a);
    expect(c).toEqual(a);
    fetchSpy.mockRestore();
  });

  it("does not dedupe across different instrument keys", async () => {
    const keyA = uniqueKey();
    const keyB = uniqueKey();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(200, { candles: sampleCandles }));

    await Promise.all([fetchCandlesForInstrument(keyA), fetchCandlesForInstrument(keyB)]);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    fetchSpy.mockRestore();
  });

  it("issues a fresh request for a later, non-concurrent call once the first has resolved and the result is cached", async () => {
    const key = uniqueKey();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(200, { candles: sampleCandles }));

    await fetchCandlesForInstrument(key);
    await fetchCandlesForInstrument(key); // within the 15-minute cache TTL

    expect(fetchSpy).toHaveBeenCalledTimes(1); // second call served from cache, not a new request
    fetchSpy.mockRestore();
  });

  it("forceRefresh bypasses the cache and issues a new request", async () => {
    const key = uniqueKey();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(200, { candles: sampleCandles }));

    await fetchCandlesForInstrument(key);
    await fetchCandlesForInstrument(key, { forceRefresh: true });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    fetchSpy.mockRestore();
  });

  it("does not leave a stale in-flight entry after a failed request — a later call retries", async () => {
    const key = uniqueKey();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(jsonResponse(500, { error: "Upstox request failed (500)." }));

    const first = await fetchCandlesForInstrument(key);
    expect(first.ok).toBe(false);

    fetchSpy.mockResolvedValueOnce(jsonResponse(200, { candles: sampleCandles }));
    const second = await fetchCandlesForInstrument(key);

    expect(second).toEqual({ ok: true, candles: sampleCandles });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    fetchSpy.mockRestore();
  });
});

describe("fetchCandlesForInstrument — 429 retry with backoff", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("retries on 429 and succeeds once Upstox stops rate-limiting", async () => {
    const key = uniqueKey();
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(429, { error: "rate limited" }))
      .mockResolvedValueOnce(jsonResponse(200, { candles: sampleCandles }));

    const resultPromise = fetchCandlesForInstrument(key);
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result).toEqual({ ok: true, candles: sampleCandles });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    fetchSpy.mockRestore();
  });

  it("gives up after exhausting retries and returns a friendly, non-technical error", async () => {
    const key = uniqueKey();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(429, { error: "rate limited" }));

    const resultPromise = fetchCandlesForInstrument(key);
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Upstox is temporarily rate-limiting requests. Please try again shortly.");
      expect(result.error).not.toMatch(/429/);
      expect(result.error).not.toMatch(/token/i);
    }
    // Initial attempt + RATE_LIMIT_MAX_RETRIES retries.
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    fetchSpy.mockRestore();
  });

  it("honors a Retry-After header when present instead of the default backoff", async () => {
    const key = uniqueKey();
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(429, { error: "rate limited" }, { "Retry-After": "1" }))
      .mockResolvedValueOnce(jsonResponse(200, { candles: sampleCandles }));

    const resultPromise = fetchCandlesForInstrument(key);
    await vi.advanceTimersByTimeAsync(1000);
    const result = await resultPromise;

    expect(result).toEqual({ ok: true, candles: sampleCandles });
    fetchSpy.mockRestore();
  });

  it("does not retry on non-429 errors — fails immediately with the proxy's own error text", async () => {
    const key = uniqueKey();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(503, { error: "Upstox access token is not configured on the server (UPSTOX_ACCESS_TOKEN)." }));

    const result = await fetchCandlesForInstrument(key);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: false, error: "Upstox access token is not configured on the server (UPSTOX_ACCESS_TOKEN)." });
    fetchSpy.mockRestore();
  });
});

describe("fetchCandlesForInstrument — network failure", () => {
  it("returns a descriptive error without throwing when fetch itself rejects", async () => {
    const key = uniqueKey();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));

    const result = await fetchCandlesForInstrument(key);

    expect(result.ok).toBe(false);
    fetchSpy.mockRestore();
  });
});

describe("fetchUpstoxStatus", () => {
  it("returns the parsed status on success", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(200, { configured: true, tokenLength: 337 }));
    expect(await fetchUpstoxStatus()).toEqual({ configured: true, tokenLength: 337 });
    fetchSpy.mockRestore();
  });

  it("reports not configured on a network failure, without throwing", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    expect(await fetchUpstoxStatus()).toEqual({ configured: false });
    fetchSpy.mockRestore();
  });
});
