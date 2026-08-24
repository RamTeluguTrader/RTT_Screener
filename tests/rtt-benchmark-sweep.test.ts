import { describe, expect, it } from "vitest";

import { runRttBenchmark } from "../src/lib/rtt-benchmark";

const SIZES = [60, 500, 1000, 2000];

function formatBytes(bytes: number | null): string {
  if (bytes === null) return "n/a";
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

describe("RTT benchmark sweep (60/500/1000/2000)", () => {
  for (const size of SIZES) {
    it(`benchmarks ${size} synthetic stocks through the existing RTT pipeline`, () => {
      const result = runRttBenchmark(size);

      console.log(
        [
          `stocks=${result.stockCount}`,
          `totalMs=${result.totalMs.toFixed(2)}`,
          `qualified=${result.qualifiedCount}`,
          `rejected=${result.rejectedCount}`,
          `errors=${result.errorCount}`,
          `heapUsedDelta=${formatBytes(result.heapUsedDeltaBytes)}`,
          `msPerStock=${(result.totalMs / result.stockCount).toFixed(3)}`,
        ].join("  "),
      );

      expect(result.errorCount).toBe(0);
      expect(result.qualifiedCount + result.rejectedCount).toBe(size);
    });
  }
});
