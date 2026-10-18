import { describe, expect, it } from "vitest";
import { runProcessingBenchmarks } from "./bench.ts";

describe("processing benchmarks", () => {
  it("finishes representative synthetic workloads quickly enough to stay on the main thread", () => {
    const results = runProcessingBenchmarks();
    for (const result of results) {
      expect(result.milliseconds).toBeGreaterThanOrEqual(0);
      expect(result.milliseconds).toBeLessThan(1500);
      console.info(`${result.label}: ${result.milliseconds.toFixed(1)} ms (${result.rows} rows)`);
    }
  });
});
