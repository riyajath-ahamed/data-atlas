import { quadtree } from "d3-quadtree";
import { describe, expect, it } from "vitest";
import { populationWeightedMean } from "../aggregation/aggregate.ts";
import { buildIndex } from "../indexing/buildIndex.ts";
import { findNearest } from "../indexing/quadtreeIndex.ts";
import type { CountryMetadata, CountryObservation } from "../../data/schemas/types.ts";

describe("aggregation and spatial index", () => {
  it("does not treat a missing population as zero weight", () => {
    const countries: CountryMetadata[] = [
      { countryCode: "AAA", name: "A", region: "North", incomeGroup: null, isoNumeric: null },
      { countryCode: "BBB", name: "B", region: "North", incomeGroup: null, isoNumeric: null },
    ];
    const rows: CountryObservation[] = [
      { countryCode: "AAA", year: 2000, population: 100, lifeExpectancy: 50, gdpPerCapita: null, internetPenetration: null, co2PerCapita: null, renewableEnergyShare: null },
      { countryCode: "BBB", year: 2000, population: null, lifeExpectancy: 80, gdpPerCapita: null, internetPenetration: null, co2PerCapita: null, renewableEnergyShare: null },
    ];
    const index = buildIndex(countries, rows);
    expect(populationWeightedMean(index, "North", 2000, "lifeExpectancy").value).toBe(50);
  });

  it("finds the nearest point inside a radius", () => {
    const index = quadtree<{ x: number; y: number; datum: string }>()
      .x((point) => point.x)
      .y((point) => point.y)
      .addAll([
        { x: 0, y: 0, datum: "a" },
        { x: 10, y: 10, datum: "b" },
      ]);
    expect(findNearest(index, 1, 1, 3)).toBe("a");
    expect(findNearest(index, 5, 5, 2)).toBeNull();
  });
});
