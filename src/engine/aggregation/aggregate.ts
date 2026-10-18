import type { MetricId } from "../../data/schemas/types.ts";
import type { DatasetIndex } from "../indexing/buildIndex.ts";

export interface RegionalMean {
  region: string;
  year: number;
  value: number | null;
  countries: number;
}

/**
 * Population-weighted mean of a metric among countries in a region and year.
 * Countries missing the metric or population are omitted, not treated as zero.
 * Returns an unweighted mean when no population weights are available.
 */
export function populationWeightedMean(
  index: DatasetIndex,
  region: string,
  year: number,
  metric: MetricId,
): RegionalMean {
  const rows = (index.byYear.get(year) ?? []).filter((row) => index.countryByCode.get(row.countryCode)?.region === region);
  let weighted = 0;
  let weight = 0;
  let unweighted = 0;
  let unweightedCount = 0;
  for (const row of rows) {
    const value = row[metric];
    if (value == null) continue;
    unweighted += value;
    unweightedCount += 1;
    if (row.population != null && row.population > 0) {
      weighted += value * row.population;
      weight += row.population;
    }
  }
  const value = weight > 0 ? weighted / weight : unweightedCount > 0 ? unweighted / unweightedCount : null;
  return { region, year, value, countries: unweightedCount };
}
