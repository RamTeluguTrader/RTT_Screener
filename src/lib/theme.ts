import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "rtt.theme.v1";

const listeners = new Set<() => void>();

export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark";
}

/**
 * A saved preference always wins; otherwise fall back to the OS preference once.
 * Kept pure so it mirrors (and can be tested against) the inline bootstrap
 * script in index.html that prevents a flash of the wrong theme on load.
 */
export function resolveTheme(stored: string | null, prefersDark: boolean): Theme {
  if (isTheme(stored)) return stored;
  return prefersDark ? "dark" : "light";
}

function prefersDarkScheme(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-color-scheme: dark)").matches
    : false;
}

function readStoredTheme(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    return null;
  }
}

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
}

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function currentTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function serverTheme(): Theme {
  return "dark";
}

/** Applies the resolved theme to the document. Safe to call more than once. */
export function initializeTheme() {
  applyTheme(resolveTheme(readStoredTheme(), prefersDarkScheme()));
}

export function setTheme(theme: Theme) {
  applyTheme(theme);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      /* localStorage may be unavailable (private mode, disabled storage); theme still applies for this session. */
    }
  }
  emit();
}

export function toggleTheme() {
  setTheme(currentTheme() === "dark" ? "light" : "dark");
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, currentTheme, serverTheme);
}
