import type { CountryMetadata, CountryObservation, ValidationIssue } from "../../data/schemas/types.ts";

export interface DatasetIndex {
  countries: CountryMetadata[];
  countryByCode: Map<string, CountryMetadata>;
  observations: CountryObservation[];
  byCountry: Map<string, CountryObservation[]>;
  byYear: Map<number, CountryObservation[]>;
  years: number[];
  regions: string[];
  issues: ValidationIssue[];
}

export function buildIndex(
  countries: CountryMetadata[],
  observations: CountryObservation[],
  issues: ValidationIssue[] = [],
): DatasetIndex {
  const countryByCode = new Map(countries.map((country) => [country.countryCode, country]));
  const knownIssues = [...issues];
  const byCountry = new Map<string, CountryObservation[]>();
  const byYear = new Map<number, CountryObservation[]>();

  for (const observation of observations) {
    if (!countryByCode.has(observation.countryCode)) {
      knownIssues.push({
        level: "warning",
        message: `Observation ${observation.countryCode} ${observation.year} has no country metadata and is omitted.`,
      });
      continue;
    }
    const countryRows = byCountry.get(observation.countryCode) ?? [];
    countryRows.push(observation);
    byCountry.set(observation.countryCode, countryRows);
    const yearRows = byYear.get(observation.year) ?? [];
    yearRows.push(observation);
    byYear.set(observation.year, yearRows);
  }

  for (const rows of byCountry.values()) {
    rows.sort((a, b) => a.year - b.year);
  }

  const years = [...byYear.keys()].sort((a, b) => a - b);
  const regions = [...new Set(countries.map((country) => country.region))].sort((a, b) => a.localeCompare(b));
  const kept = [...byCountry.values()].flat();

  return {
    countries,
    countryByCode,
    observations: kept,
    byCountry,
    byYear,
    years,
    regions,
    issues: knownIssues,
  };
}
