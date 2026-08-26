import { describe, expect, it } from "vitest";

import {
  describeScoreChange,
  describeTrendStructureChange,
  formatScoreDelta,
  friendlyRejectionReason,
  trendStructureLabel,
} from "../src/lib/rtt2x-presentation";
import type { Rtt2xLiveRow } from "../src/lib/rtt2x-live-data";

type ScoreResult = Rtt2xLiveRow["result"];

function fakeResult(overrides: Partial<ScoreResult>): ScoreResult {
  return {
    symbol: "TEST",
    qualified: true,
    rejectionReason: null,
    rttScore: 75,
    classification: "Good",
    rsi: 55,
    momentum20d: 5,
    rvol: 1,
    extensionPct: 2,
    sectorContext: null,
    emaStructureScore: { score: 10, maximum: 14, unavailableReason: null },
    emaSlopeExpansionScore: { score: 10, maximum: 14, unavailableReason: null },
    ema20ResilienceScore: { score: 15, maximum: 22, unavailableReason: null },
    ema50ResilienceScore: { score: 10, maximum: 14, unavailableReason: null },
    trendDevelopmentScore: { score: 5, maximum: 10, unavailableReason: null },
    momentumScore: { score: 5, maximum: 8, unavailableReason: null },
    extensionScore: { score: 5, maximum: 8, unavailableReason: null },
    volumeScore: { score: 3, maximum: 5, unavailableReason: null },
    rsiHealthScore: { score: 3, maximum: 5, unavailableReason: null },
    ...overrides,
  } as ScoreResult;
}

describe("trendStructureLabel", () => {
  it("never exposes the underlying qualification rule for a not-qualified stock", () => {
    const label = trendStructureLabel(fakeResult({ qualified: false, classification: null }));
    expect(label).toBe("Not yet established");
    expect(label.toLowerCase()).not.toContain("align");
    expect(label.toLowerCase()).not.toContain("ema10");
  });

  it("maps Exceptional/Strong to 'Strong trend'", () => {
    expect(trendStructureLabel(fakeResult({ classification: "Exceptional" }))).toBe("Strong trend");
    expect(trendStructureLabel(fakeResult({ classification: "Strong" }))).toBe("Strong trend");
  });

  it("maps Good/Watch to 'Healthy trend'", () => {
    expect(trendStructureLabel(fakeResult({ classification: "Good" }))).toBe("Healthy trend");
    expect(trendStructureLabel(fakeResult({ classification: "Watch" }))).toBe("Healthy trend");
  });

  it("maps Weak to 'Developing trend'", () => {
    expect(trendStructureLabel(fakeResult({ classification: "Weak" }))).toBe("Developing trend");
  });
});

describe("friendlyRejectionReason", () => {
  it("never leaks the raw enum name or the EMA ordering rule", () => {
    const text = friendlyRejectionReason("EMA_ALIGNMENT_FAILED");
    expect(text).not.toMatch(/EMA_ALIGNMENT_FAILED/);
    expect(text).not.toMatch(/alignment/i);
    expect(text).not.toMatch(/EMA10 ?> ?EMA20/);
  });

  it("has friendly text for every known rejection reason", () => {
    expect(friendlyRejectionReason("EMA_ALIGNMENT_FAILED")).toBe("Trend structure not yet established");
    expect(friendlyRejectionReason("INSUFFICIENT_DATA")).toBe("Not enough price history available");
    expect(friendlyRejectionReason("INVALID_DATA")).toBe("A data issue prevented scoring");
    expect(friendlyRejectionReason(null)).toBe("Not qualified");
  });
});

describe("describeScoreChange (Watchlist 'What changed')", () => {
  it("reports unavailable live data without exposing an API/error message", () => {
    expect(describeScoreChange(null, null)).toBe("Live analysis is temporarily unavailable for this stock.");
  });

  it("reports 'first check' when there is no prior snapshot", () => {
    expect(describeScoreChange(75, null)).toBe("First check — nothing to compare yet.");
  });

  it("reports an increase", () => {
    const text = describeScoreChange(80.2, { score: 75, timestamp: 0 });
    expect(text).toBe("RTT score increased by 5.2 points since your last check.");
  });

  it("reports a decrease", () => {
    const text = describeScoreChange(68, { score: 75, timestamp: 0 });
    expect(text).toBe("RTT score decreased by 7.0 points since your last check.");
  });

  it("reports no major change for a small delta", () => {
    expect(describeScoreChange(75.4, { score: 75, timestamp: 0 })).toBe("No major change since your last check.");
  });

  it("never claims a specific day like 'yesterday' — uses 'since last check' framing only", () => {
    const text = describeScoreChange(80, { score: 75, timestamp: 0 });
    expect(text.toLowerCase()).not.toContain("yesterday");
    expect(text).toContain("since your last check");
  });
});

describe("formatScoreDelta", () => {
  it("formats a positive delta with a leading +", () => {
    expect(formatScoreDelta(80, { score: 75, timestamp: 0 })).toBe("+5.0");
  });

  it("formats a negative delta", () => {
    expect(formatScoreDelta(70, { score: 75, timestamp: 0 })).toBe("-5.0");
  });

  it("returns null when there's nothing to compare", () => {
    expect(formatScoreDelta(80, null)).toBeNull();
    expect(formatScoreDelta(null, { score: 75, timestamp: 0 })).toBeNull();
  });
});

describe("describeTrendStructureChange", () => {
  it("returns null when the classification band hasn't changed", () => {
    const result = fakeResult({ classification: "Good", rttScore: 72 });
    expect(describeTrendStructureChange(result, { score: 71, timestamp: 0 })).toBeNull();
  });

  it("describes an improvement using only friendly terminology", () => {
    const result = fakeResult({ classification: "Strong", rttScore: 82 });
    const text = describeTrendStructureChange(result, { score: 55, timestamp: 0 }); // 55 -> Weak -> "Developing"
    expect(text).toBe("Trend structure moved from Developing to Strong.");
  });

  it("returns null with no prior snapshot", () => {
    const result = fakeResult({ classification: "Strong", rttScore: 82 });
    expect(describeTrendStructureChange(result, null)).toBeNull();
  });

  it("returns null for a not-qualified current result", () => {
    const result = fakeResult({ qualified: false, classification: null, rttScore: null });
    expect(describeTrendStructureChange(result, { score: 55, timestamp: 0 })).toBeNull();
  });
});
