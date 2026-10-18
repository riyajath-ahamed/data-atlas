import { describe, expect, it } from "vitest";
import { clusterOrder, correlatePair, correlationMatrix, pearson } from "./correlation.ts";
import { studentTTwoTailedP } from "./studentT.ts";

describe("correlation", () => {
  it("returns 1 for a perfect line and null when variance is zero", () => {
    expect(pearson([1, 2, 3], [2, 4, 6])?.r).toBeCloseTo(1);
    expect(pearson([1, 1, 1], [2, 3, 4])).toBeNull();
    expect(pearson([1, 2], [3, 4])).toBeNull();
  });

  it("reports a two-sided t test only when n is large enough", () => {
    const flat = correlatePair([1, 2, 3, 4, 5], [1, 2, 3, 4, 6]);
    expect(flat?.n).toBe(5);
    expect(flat?.p).not.toBeNull();
    expect(studentTTwoTailedP(0, 12)).toBeCloseTo(1);
    expect(studentTTwoTailedP(1.96, 1000)).toBeGreaterThan(0.04);
    expect(studentTTwoTailedP(1.96, 1000)).toBeLessThan(0.06);
  });

  it("skips pairs with missing values", () => {
    const cells = correlationMatrix(
      [
        { a: 1, b: 2 },
        { a: 2, b: null },
        { a: 3, b: 6 },
        { a: 4, b: 8 },
      ],
      ["a", "b"],
    );
    const pair = cells.find((cell) => cell.left === "a" && cell.right === "b");
    expect(pair?.result?.n).toBe(3);
    expect(pair?.result?.r).toBeCloseTo(1);
  });

  it("orders indicators by profile similarity", () => {
    const rows = [
      { a: 1, b: 2, c: 10 },
      { a: 2, b: 4, c: 9 },
      { a: 3, b: 6, c: 8 },
      { a: 4, b: 8, c: 7 },
    ];
    const cells = correlationMatrix(rows, ["a", "b", "c"]);
    const order = clusterOrder(["a", "b", "c"], cells);
    expect(Math.abs(order.indexOf("a") - order.indexOf("b"))).toBe(1);
  });
});
