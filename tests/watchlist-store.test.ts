import { beforeEach, afterEach, describe, expect, it } from "vitest";

import {
  __resetWatchlistForTests,
  addToWatchlist,
  getWatchlistSnapshot,
  getWatchlistSymbols,
  hydrateWatchlist,
  isInWatchlist,
  removeFromWatchlist,
  updateWatchlistSnapshot,
  WATCHLIST_MAX,
  WATCHLIST_SNAPSHOT_STORAGE_KEY,
  WATCHLIST_STORAGE_KEY,
} from "../src/lib/watchlist-store";

/** Minimal in-memory localStorage mock — no jsdom/testing-library dependency, matching this
 * project's existing convention of testing store logic without real browser globals. Node has
 * no `window` global by default, and watchlist-store.ts intentionally gates all persistence on
 * `typeof window === "undefined"`, so assigning a fake `window` here is what makes the
 * persistence path (not just the in-memory path) exercisable in tests. */
function createMockLocalStorage() {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => (key in store ? store[key]! : null),
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
}

let mockStorage: ReturnType<typeof createMockLocalStorage>;

beforeEach(() => {
  __resetWatchlistForTests();
  mockStorage = createMockLocalStorage();
  (globalThis as unknown as { window: unknown }).window = { localStorage: mockStorage };
});

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe("watchlist store — basic add/remove", () => {
  it("starts empty", () => {
    expect(getWatchlistSymbols()).toEqual([]);
  });

  it("adds a stock", () => {
    expect(addToWatchlist("HAL")).toBe("added");
    expect(getWatchlistSymbols()).toEqual(["HAL"]);
    expect(isInWatchlist("HAL")).toBe(true);
  });

  it("removes a stock", () => {
    addToWatchlist("HAL");
    removeFromWatchlist("HAL");
    expect(getWatchlistSymbols()).toEqual([]);
    expect(isInWatchlist("HAL")).toBe(false);
  });

  it("removing a symbol that isn't present is a safe no-op", () => {
    addToWatchlist("HAL");
    expect(() => removeFromWatchlist("NOT_PRESENT")).not.toThrow();
    expect(getWatchlistSymbols()).toEqual(["HAL"]);
  });

  it("cannot add the same stock twice", () => {
    expect(addToWatchlist("HAL")).toBe("added");
    expect(addToWatchlist("HAL")).toBe("already_present");
    expect(getWatchlistSymbols()).toEqual(["HAL"]);
  });
});

describe("watchlist store — 20-stock limit", () => {
  it("allows exactly 20 stocks", () => {
    for (let i = 0; i < WATCHLIST_MAX; i += 1) {
      expect(addToWatchlist(`SYM${i}`)).toBe("added");
    }
    expect(getWatchlistSymbols()).toHaveLength(20);
  });

  it("rejects the 21st stock without removing or replacing anything", () => {
    for (let i = 0; i < WATCHLIST_MAX; i += 1) addToWatchlist(`SYM${i}`);
    const before = getWatchlistSymbols();
    expect(addToWatchlist("SYM_EXTRA")).toBe("full");
    expect(getWatchlistSymbols()).toEqual(before);
    expect(getWatchlistSymbols()).toHaveLength(20);
  });

  it("adding does not silently replace an existing entry when full", () => {
    for (let i = 0; i < WATCHLIST_MAX; i += 1) addToWatchlist(`SYM${i}`);
    addToWatchlist("SYM_EXTRA");
    expect(getWatchlistSymbols()).not.toContain("SYM_EXTRA");
    expect(getWatchlistSymbols()).toContain("SYM0");
  });

  it("freeing a slot allows adding again", () => {
    for (let i = 0; i < WATCHLIST_MAX; i += 1) addToWatchlist(`SYM${i}`);
    removeFromWatchlist("SYM0");
    expect(addToWatchlist("SYM_NEW")).toBe("added");
    expect(getWatchlistSymbols()).toHaveLength(20);
  });
});

describe("watchlist store — persistence", () => {
  it("survives a simulated reload (in-memory reset, localStorage retained)", () => {
    addToWatchlist("HAL");
    addToWatchlist("TCS");

    // Simulate a page reload: in-memory module state resets, the mock localStorage does not.
    __resetWatchlistForTests();
    hydrateWatchlist();

    expect(getWatchlistSymbols()).toEqual(["HAL", "TCS"]);
  });

  it("persists to the documented, namespaced localStorage key", () => {
    addToWatchlist("HAL");
    const raw = mockStorage.getItem(WATCHLIST_STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!)).toEqual(["HAL"]);
  });

  it("stores only symbols, not full market-data objects", () => {
    addToWatchlist("HAL");
    const raw = JSON.parse(mockStorage.getItem(WATCHLIST_STORAGE_KEY)!);
    expect(raw).toEqual(["HAL"]);
    expect(raw[0]).not.toHaveProperty("price");
    expect(raw[0]).not.toHaveProperty("rttScore");
  });

  it("persists snapshots to a separate, namespaced key and survives reload", () => {
    updateWatchlistSnapshot("HAL", 72.5, 1_700_000_000_000);
    expect(getWatchlistSnapshot("HAL")).toEqual({ score: 72.5, timestamp: 1_700_000_000_000 });

    __resetWatchlistForTests();
    hydrateWatchlist();

    expect(getWatchlistSnapshot("HAL")).toEqual({ score: 72.5, timestamp: 1_700_000_000_000 });
    expect(mockStorage.getItem(WATCHLIST_SNAPSHOT_STORAGE_KEY)).not.toBeNull();
  });
});

describe("watchlist store — corrupted localStorage is handled gracefully", () => {
  it("falls back to an empty watchlist on invalid JSON, without throwing", () => {
    mockStorage.setItem(WATCHLIST_STORAGE_KEY, "{not valid json");
    expect(() => hydrateWatchlist()).not.toThrow();
    expect(getWatchlistSymbols()).toEqual([]);
  });

  it("falls back to an empty watchlist when the stored shape is wrong (not a string array)", () => {
    mockStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify({ not: "an array" }));
    expect(() => hydrateWatchlist()).not.toThrow();
    expect(getWatchlistSymbols()).toEqual([]);
  });

  it("falls back to an empty watchlist when the array contains non-string entries", () => {
    mockStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(["HAL", 123, null]));
    hydrateWatchlist();
    expect(getWatchlistSymbols()).toEqual([]);
  });

  it("deduplicates and caps at 20 if corrupted/legacy data somehow exceeds the limit", () => {
    const tooMany = Array.from({ length: 30 }, (_, i) => `SYM${i}`);
    mockStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(tooMany));
    hydrateWatchlist();
    expect(getWatchlistSymbols()).toHaveLength(20);
  });

  it("falls back to an empty snapshot map on invalid snapshot JSON, without throwing", () => {
    mockStorage.setItem(WATCHLIST_SNAPSHOT_STORAGE_KEY, "not json at all {");
    expect(() => hydrateWatchlist()).not.toThrow();
    expect(getWatchlistSnapshot("HAL")).toBeNull();
  });

  it("ignores a malformed snapshot entry shape", () => {
    mockStorage.setItem(WATCHLIST_SNAPSHOT_STORAGE_KEY, JSON.stringify({ HAL: { score: "not a number" } }));
    hydrateWatchlist();
    expect(getWatchlistSnapshot("HAL")).toBeNull();
  });
});

describe("watchlist store — unknown/invalid symbol handling", () => {
  it("allows adding a symbol not present in the RTT universe without throwing (the store itself has no universe knowledge)", () => {
    expect(() => addToWatchlist("NOT_A_REAL_SYMBOL")).not.toThrow();
    expect(isInWatchlist("NOT_A_REAL_SYMBOL")).toBe(true);
  });

  it("handles an empty-string symbol without throwing (defensive, even though the UI never sends one)", () => {
    expect(() => addToWatchlist("")).not.toThrow();
  });
});
