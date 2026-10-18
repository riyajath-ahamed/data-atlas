import { describe, expect, it } from "vitest";
import observationsCsv from "./observations.csv?raw";
import { parseObservations } from "../ingestion/parseObservations.ts";

describe("bundled World Bank sample", () => {
  const csv = observationsCsv;
  const parsed = parseObservations(csv);

  it("parses without errors and does not encode missing values as zero", () => {
    expect(parsed.issues.filter((issue) => issue.level === "error")).toEqual([]);
    expect(parsed.observations.length).toBeGreaterThan(7000);
    const blank = parsed.observations.find((row) => row.renewableEnergyShare == null);
    expect(blank).toBeTruthy();
    expect(blank?.renewableEnergyShare).toBeNull();
  });

  it("keeps the published United States 2019 observation", () => {
    const usa = parsed.observations.find((row) => row.countryCode === "USA" && row.year === 2019);
    expect(usa?.population).toBeGreaterThan(320_000_000);
    expect(usa?.population).toBeLessThan(340_000_000);
    expect(usa?.lifeExpectancy).toBeGreaterThan(78);
    expect(usa?.lifeExpectancy).toBeLessThan(80);
    expect(usa?.gdpPerCapita).toBeGreaterThan(50_000);
  });
});
