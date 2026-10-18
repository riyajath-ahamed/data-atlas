import type { CountryMetadata, CountryObservation } from "../../data/schemas/types.ts";
import type { DatasetIndex } from "../indexing/buildIndex.ts";

export interface FilterQuery {
  year?: number;
  yearRange?: [number, number];
  regions?: string[];
  search?: string;
  countryCodes?: string[] | null;
}

export function countryMatchesSearch(country: CountryMetadata, search: string): boolean {
  const query = search.trim().toLowerCase();
  if (!query) return true;
  return country.name.toLowerCase().includes(query) || country.countryCode.toLowerCase().includes(query);
}

export function countryPasses(index: DatasetIndex, countryCode: string, query: FilterQuery): boolean {
  const country = index.countryByCode.get(countryCode);
  if (!country) return false;
  if (query.regions && query.regions.length > 0 && !query.regions.includes(country.region)) return false;
  if (query.search && !countryMatchesSearch(country, query.search)) return false;
  if (query.countryCodes && !query.countryCodes.includes(countryCode)) return false;
  return true;
}

export function filterObservations(index: DatasetIndex, query: FilterQuery): CountryObservation[] {
  const [from, to] = query.yearRange ?? [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY];
  const source = query.year == null ? index.observations : (index.byYear.get(query.year) ?? []);
  return source.filter((observation) => {
    if (query.yearRange && (observation.year < from || observation.year > to)) return false;
    return countryPasses(index, observation.countryCode, query);
  });
}

export function filterCountries(index: DatasetIndex, query: Pick<FilterQuery, "regions" | "search" | "countryCodes">): CountryMetadata[] {
  return index.countries.filter((country) => countryPasses(index, country.countryCode, query));
}
