import { describe, expect, it } from "vitest";
import type { CountryMetadata, CountryObservation } from "../../data/schemas/types.ts";
import { buildIndex } from "../indexing/buildIndex.ts";
import { filterCountries, filterObservations } from "./filter.ts";

const countries: CountryMetadata[] = [
  { countryCode: "NOR", name: "Norway", region: "Europe & Central Asia", incomeGroup: "High income", isoNumeric: "578" },
  { countryCode: "JPN", name: "Japan", region: "East Asia & Pacific", incomeGroup: "High income", isoNumeric: "392" },
];

function row(partial: Pick<CountryObservation, "countryCode" | "year"> & Partial<CountryObservation>): CountryObservation {
  return {
    population: null,
    gdpPerCapita: null,
    lifeExpectancy: null,
    internetPenetration: null,
    co2PerCapita: null,
    renewableEnergyShare: null,
    ...partial,
  };
}

describe("filterObservations", () => {
  const index = buildIndex(countries, [
    row({ countryCode: "NOR", year: 2000, lifeExpectancy: 78, population: 4 }),
    row({ countryCode: "NOR", year: 2010, lifeExpectancy: 81, population: 5 }),
    row({ countryCode: "JPN", year: 2010, lifeExpectancy: 83, population: 128 }),
  ]);

  it("filters by year, region, and search without turning null into zero", () => {
    expect(filterObservations(index, { year: 2010 })).toHaveLength(2);
    expect(filterObservations(index, { regions: ["East Asia & Pacific"] }).map((item) => item.countryCode)).toEqual(["JPN"]);
    expect(filterCountries(index, { search: "nor" }).map((item) => item.countryCode)).toEqual(["NOR"]);
    expect(filterObservations(index, { yearRange: [2005, 2012] })).toHaveLength(2);
    expect(index.byYear.get(2000)?.[0]?.gdpPerCapita).toBeNull();
  });
});
