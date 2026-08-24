import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const APP_SHELL_SOURCE = readFileSync(new URL("../src/components/layout/AppShell.tsx", import.meta.url), "utf8");

describe("profile menu", () => {
  it("is wired up as a functional dropdown, not the disabled stub", () => {
    expect(APP_SHELL_SOURCE).toContain("DropdownMenu");
    expect(APP_SHELL_SOURCE).not.toContain("Profile menu is not implemented in the development view");
    expect(APP_SHELL_SOURCE).not.toMatch(/aria-label="Profile menu"[\s\S]{0,80}disabled/);
  });

  it("shows only RTT User and Not connected as identity/status text", () => {
    expect(APP_SHELL_SOURCE).toContain("RTT User");
    expect(APP_SHELL_SOURCE).toContain("Not connected");
    expect(APP_SHELL_SOURCE).not.toContain("Pro desk");
  });

  it("the Settings item navigates to the existing /settings route", () => {
    expect(APP_SHELL_SOURCE).toMatch(/navigate\(\{\s*to:\s*"\/settings"\s*\}\)/);
    expect(APP_SHELL_SOURCE).toContain("Settings");
  });

  it("does not add theme toggling inside the profile menu (it stays a separate control)", () => {
    const dropdownStart = APP_SHELL_SOURCE.indexOf("<DropdownMenuContent");
    const dropdownEnd = APP_SHELL_SOURCE.indexOf("</DropdownMenu>");
    const dropdownContentSection = APP_SHELL_SOURCE.slice(dropdownStart, dropdownEnd);

    expect(dropdownContentSection).not.toContain("ThemeToggle");
    expect(dropdownContentSection).not.toMatch(/dark mode|light mode/i);
  });

  it("does not imply a connected account, broker, subscription, or payment system", () => {
    const forbidden = [
      "Sign out",
      "Sign in",
      "Log out",
      "Subscribe",
      "Subscription",
      "Pricing",
      "Upgrade",
      "Stripe",
      "Razorpay",
      "checkout",
      "Telegram",
      "Broker link",
      "connected",
    ];

    for (const word of forbidden) {
      // "Not connected" itself is fine and expected; only flag a bare/standalone "connected" claim.
      if (word === "connected") {
        expect(APP_SHELL_SOURCE.match(/(?<!Not )\bconnected\b/gi) ?? []).toEqual([]);
        continue;
      }
      expect(APP_SHELL_SOURCE).not.toContain(word);
    }
  });
});
