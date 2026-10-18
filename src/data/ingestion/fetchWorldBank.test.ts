import { describe, expect, it } from "vitest";
import { assembleWorldBankSample, type WorldBankCountryRow, type WorldBankValueRow } from "./fetchWorldBank.ts";
import type { MetricId } from "../schemas/types.ts";

const countries: WorldBankCountryRow[] = [
  { id: "USA", name: "United States", region: { id: "NAC", value: "North America" }, incomeLevel: { value: "High income" } },
  { id: "JPN", name: "Japan", region: { id: "EAS", value: "East Asia & Pacific" }, incomeLevel: { value: "High income" } },
  { id: "WLD", name: "World", region: { id: "NA", value: "Aggregates" }, incomeLevel: { value: "Aggregates" } },
];

function row(code: string, value: number | null): WorldBankValueRow {
  return { countryiso3code: code, date: "2019", value };
}

function indicators(): Record<MetricId, WorldBankValueRow[]> {
  return {
    population: [row("USA", 330_226_227), row("JPN", 0), row("WLD", 7_000_000_000)],
    gdpPerCapita: [row("USA", 65_228), row("JPN", 40_000)],
    lifeExpectancy: [row("USA", 78.8), row("JPN", 84.4)],
    internetPenetration: [row("USA", null), row("JPN", 90)],
    co2PerCapita: [row("USA", 15), row("JPN", 8)],
    renewableEnergyShare: [row("USA", 10.2), row("JPN", 8)],
  };
}

describe("assembleWorldBankSample", () => {
  it("drops aggregates and nulls, and keeps a published zero", () => {
    const sample = assembleWorldBankSample({
      countryRows: countries,
      indicatorRows: indicators(),
      isoByCode: new Map([
        ["USA", "840"],
        ["JPN", "392"],
      ]),
      retrieved: "2026-10-18",
      minimumValues: 1,
      minimumYearCoverage: 1,
    });

    expect(sample.countries.map((country) => country.countryCode)).toEqual(["JPN", "USA"]);
    expect(sample.countries.find((country) => country.countryCode === "USA")?.isoNumeric).toBe("840");
    const japan = sample.observations.find((observation) => observation.countryCode === "JPN");
    const unitedStates = sample.observations.find((observation) => observation.countryCode === "USA");
    expect(japan?.population).toBe(0);
    expect(unitedStates?.internetPenetration).toBeNull();
    expect(sample.observations.some((observation) => observation.countryCode === "WLD")).toBe(false);
    expect(sample.meta.defaultYear).toBe(2019);
    expect(sample.meta.observationCount).toBe(2);
  });
});