import { describe, expect, it } from "vitest";
import { parseObservations } from "./parseObservations.ts";

const header = "countryCode,year,population,gdpPerCapita,lifeExpectancy,internetPenetration,co2PerCapita,renewableEnergyShare";

describe("parseObservations", () => {
  it("keeps missing cells as null", () => {
    const parsed = parseObservations(`${header}\nNOR,2019,5328000,,82.9,,7.1,\n`);
    expect(parsed.issues.filter((issue) => issue.level === "error")).toHaveLength(0);
    expect(parsed.observations[0]).toMatchObject({
      countryCode: "NOR",
      year: 2019,
      population: 5328000,
      gdpPerCapita: null,
      lifeExpectancy: 82.9,
      internetPenetration: null,
      co2PerCapita: 7.1,
      renewableEnergyShare: null,
    });
  });

  it("drops duplicate country-year rows and keeps the first", () => {
    const parsed = parseObservations(`${header}\nNOR,2019,1,,,,,,\nNOR,2019,2,,,,,,\n`);
    expect(parsed.observations).toHaveLength(1);
    expect(parsed.observations[0]?.population).toBe(1);
    expect(parsed.issues.some((issue) => issue.message.includes("Duplicate"))).toBe(true);
  });

  it("rejects an empty file and a bad header", () => {
    expect(parseObservations("").observations).toHaveLength(0);
    const parsed = parseObservations("foo,bar\n1,2\n");
    expect(parsed.observations).toHaveLength(0);
    expect(parsed.issues[0]?.level).toBe("error");
  });

  it("rejects negative population and non-numeric cells", () => {
    const negative = parseObservations(`${header}\nNOR,2019,-5,,,,,,\n`);
    expect(negative.observations).toHaveLength(0);
    const broken = parseObservations(`${header}\nNOR,2019,abc,,,,,,\n`);
    expect(broken.observations).toHaveLength(0);
  });
});
