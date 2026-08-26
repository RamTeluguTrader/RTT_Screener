import { useEffect, useSyncExternalStore } from "react";

/**
 * "My Watchlist" — stocks the user chose to monitor, independent of Top 10 /
 * Top 20 / Emerging / Recently Weakened (system-generated categories). A
 * stock stays here even after its RTT score falls or it drops out of those
 * lists entirely; nothing in this file ever removes a stock automatically.
 *
 * V1 persistence: browser localStorage only (no account backend). Follows
 * the same useSyncExternalStore + localStorage pattern as alerts-store.ts.
 * Only NSE symbols are stored as the source of truth — no prices or RTT
 * scores are persisted as authoritative data. A separate, explicitly
 * "snapshot" (informational-only) key stores the last-seen score + when it
 * was seen, purely so the Watchlist page can show "since last check".
 */

export const WATCHLIST_STORAGE_KEY = "rtt2x_watchlist";
export const WATCHLIST_SNAPSHOT_STORAGE_KEY = "rtt2x_watchlist_snapshots";
export const WATCHLIST_MAX = 20;

export type WatchlistSnapshot = { score: number; timestamp: number };
type SnapshotMap = Record<string, WatchlistSnapshot>;

let symbols: string[] = [];
let snapshots: SnapshotMap = {};
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function persistSymbols() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(symbols));
}

function persistSnapshots() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(WATCHLIST_SNAPSHOT_STORAGE_KEY, JSON.stringify(snapshots));
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isSnapshotMap(value: unknown): value is SnapshotMap {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  return Object.values(value as Record<string, unknown>).every(
    (entry) =>
      typeof entry === "object" &&
      entry !== null &&
      typeof (entry as { score?: unknown }).score === "number" &&
      Number.isFinite((entry as { score: number }).score) &&
      typeof (entry as { timestamp?: unknown }).timestamp === "number" &&
      Number.isFinite((entry as { timestamp: number }).timestamp),
  );
}

/** Reads persisted state once. Corrupted/invalid JSON is treated as empty — never throws. */
export function hydrateWatchlist() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;

  try {
    const raw = window.localStorage.getItem(WATCHLIST_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    symbols = isStringArray(parsed) ? Array.from(new Set(parsed)).slice(0, WATCHLIST_MAX) : [];
  } catch {
    symbols = [];
  }

  try {
    const raw = window.localStorage.getItem(WATCHLIST_SNAPSHOT_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    snapshots = isSnapshotMap(parsed) ? parsed : {};
  } catch {
    snapshots = {};
  }

  emit();
}

/** Test-only: resets in-memory state so each test starts clean regardless of hydration order. */
export function __resetWatchlistForTests() {
  symbols = [];
  snapshots = {};
  hydrated = false;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const EMPTY_SYMBOLS: string[] = [];

export function useWatchlist(): string[] {
  useEffect(() => {
    hydrateWatchlist();
  }, []);
  return useSyncExternalStore(subscribe, () => symbols, () => EMPTY_SYMBOLS);
}

export function getWatchlistSymbols(): readonly string[] {
  return symbols;
}

export function isInWatchlist(symbol: string): boolean {
  return symbols.includes(symbol);
}

export type AddToWatchlistResult = "added" | "already_present" | "full";

/** Adding never silently replaces another stock — a full list must be handled by the caller. */
export function addToWatchlist(symbol: string): AddToWatchlistResult {
  if (symbols.includes(symbol)) return "already_present";
  if (symbols.length >= WATCHLIST_MAX) return "full";
  symbols = [...symbols, symbol];
  persistSymbols();
  emit();
  return "added";
}

export function removeFromWatchlist(symbol: string) {
  if (!symbols.includes(symbol)) return;
  symbols = symbols.filter((existing) => existing !== symbol);
  persistSymbols();
  emit();
}

/** The last score seen for this symbol, if any — informational only, never authoritative. */
export function getWatchlistSnapshot(symbol: string): WatchlistSnapshot | null {
  return snapshots[symbol] ?? null;
}

export function updateWatchlistSnapshot(symbol: string, score: number, timestamp = Date.now()) {
  snapshots = { ...snapshots, [symbol]: { score, timestamp } };
  persistSnapshots();
}
