import { METRIC_IDS, type CountryObservation, type MetricId } from "../../data/schemas/types.ts";

/** Deterministic generator for performance tests. Values are synthetic and must not be presented as observations. */
export function makeSyntheticObservations(count: number, seed = 1): CountryObservation[] {
  const random = mulberry32(seed);
  const rows: CountryObservation[] = [];
  for (let index = 0; index < count; index += 1) {
    const population = 100_000 + random() * 50_000_000;
    rows.push({
      countryCode: "SYN",
      year: 1990 + (index % 30),
      population,
      gdpPerCapita: Math.exp(random() * 10),
      lifeExpectancy: 50 + random() * 35,
      internetPenetration: random() * 100,
      co2PerCapita: random() * 20,
      renewableEnergyShare: random() * 80,
    });
  }
  return rows;
}

export function syntheticRows(count: number): Record<MetricId, number | null>[] {
  return makeSyntheticObservations(count).map((row) => {
    const record = {} as Record<MetricId, number | null>;
    for (const metric of METRIC_IDS) record[metric] = row[metric];
    return record;
  });
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
