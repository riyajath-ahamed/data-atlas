import { describe, expect, it } from "vitest";
import { paddedDomain } from "./domains.ts";

describe("paddedDomain", () => {
  it("returns null when a log scale has no positive values", () => {
    expect(paddedDomain([0, -4], "log")).toBeNull();
    expect(paddedDomain([], "linear")).toBeNull();
  });

  it("expands a single-value domain", () => {
    const domain = paddedDomain([10], "linear");
    expect(domain?.[0]).toBeLessThan(10);
    expect(domain?.[1]).toBeGreaterThan(10);
    const logDomain = paddedDomain([10], "log");
    expect(logDomain).toEqual([10 / 1.5, 15]);
  });
});
