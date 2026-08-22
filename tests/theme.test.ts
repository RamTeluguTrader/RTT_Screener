import { describe, expect, it } from "vitest";

import { isTheme, resolveTheme, THEME_STORAGE_KEY } from "../src/lib/theme";

describe("theme resolution", () => {
  it("uses a saved preference regardless of the OS preference", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("falls back to the OS preference only when nothing is saved", () => {
    expect(resolveTheme(null, true)).toBe("dark");
    expect(resolveTheme(null, false)).toBe("light");
  });

  it("ignores an invalid or corrupted stored value and falls back to the OS preference", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("", false)).toBe("light");
    expect(resolveTheme("DARK", true)).toBe("dark");
  });

  it("validates theme values with isTheme", () => {
    expect(isTheme("light")).toBe(true);
    expect(isTheme("dark")).toBe(true);
    expect(isTheme("system")).toBe(false);
    expect(isTheme(null)).toBe(false);
    expect(isTheme(undefined)).toBe(false);
  });

  it("uses a stable, namespaced localStorage key", () => {
    expect(THEME_STORAGE_KEY).toBe("rtt.theme.v1");
  });
});
