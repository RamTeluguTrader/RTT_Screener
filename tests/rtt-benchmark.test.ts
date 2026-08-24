import { describe, expect, it } from "vitest";

import { runRttBenchmark } from "../src/lib/rtt-benchmark";

describe("RTT pipeline benchmark", () => {
  it("processes a small synthetic universe through the existing pipeline without errors", () => {
    const result = runRttBenchmark(60);

    expect(result.stockCount).toBe(60);
    expect(result.errorCount).toBe(0);
    expect(result.errors).toEqual([]);
    expect(result.qualifiedCount + result.rejectedCount).toBe(60);
    expect(result.qualifiedCount).toBeGreaterThan(0);
    expect(result.rejectedCount).toBeGreaterThan(0);
    expect(result.totalMs).toBeGreaterThanOrEqual(0);
  });

  it("is deterministic across repeated runs of the same size", () => {
    const first = runRttBenchmark(60);
    const second = runRttBenchmark(60);

    expect(second.qualifiedCount).toBe(first.qualifiedCount);
    expect(second.rejectedCount).toBe(first.rejectedCount);
    expect(second.errorCount).toBe(first.errorCount);
  });

  it("scales to a few hundred stocks without errors (kept small here to stay fast; see rtt-benchmark-sweep.test.ts for the full 60/500/1000/2000 sweep)", () => {
    const result = runRttBenchmark(300);

    expect(result.errorCount).toBe(0);
    expect(result.qualifiedCount + result.rejectedCount).toBe(300);
  });
});
