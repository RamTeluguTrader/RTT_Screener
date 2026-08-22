import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const APP_SHELL_SOURCE = readFileSync(new URL("../src/components/layout/AppShell.tsx", import.meta.url), "utf8");
const SETTINGS_SOURCE = readFileSync(new URL("../src/routes/settings.tsx", import.meta.url), "utf8");

describe("demo identity cleanup", () => {
  it("displays RTT User instead of a fake personal name", () => {
    expect(APP_SHELL_SOURCE).toContain("RTT User");
    expect(SETTINGS_SOURCE).toContain("RTT User");
  });

  it("no longer references the old fake identity anywhere user-facing", () => {
    for (const source of [APP_SHELL_SOURCE, SETTINGS_SOURCE]) {
      expect(source).not.toContain("Rohan Kulkarni");
      expect(source).not.toContain("Rohan");
    }
  });

  it("does not present a fake connected broker or personal email", () => {
    expect(SETTINGS_SOURCE).not.toContain("Zerodha");
    expect(SETTINGS_SOURCE).not.toContain("rohan@");
  });
});
