import { describe, expect, it } from "vitest";
import { iqrFences, isOutsideFences } from "./outliers.ts";
import { linearRegression } from "./regression.ts";

describe("outliers and regression", () => {
  it("flags points outside 1.5 IQR", () => {
    const fences = iqrFences([1, 2, 3, 4, 5, 6, 7, 8, 100]);
    expect(fences).not.toBeNull();
    expect(isOutsideFences(100, fences)).toBe(true);
    expect(isOutsideFences(5, fences)).toBe(false);
    expect(iqrFences([1, 2])).toBeNull();
  });

  it("fits a line in the coordinates it is given", () => {
    const fit = linearRegression([1, 2, 3, 4], [3, 5, 7, 9]);
    expect(fit?.slope).toBeCloseTo(2);
    expect(fit?.intercept).toBeCloseTo(1);
  });
});
