import type { MetricId } from "../data/schemas/types.ts";
import type { DatasetIndex } from "../engine/indexing/buildIndex.ts";
import { filterCountries, filterObservations } from "../engine/transforms/filter.ts";
import type { ExplorationSnapshot } from "./exploration-store.ts";

export function viewFilter(state: Pick<ExplorationSnapshot, "regions" | "search" | "year" | "yearRange" | "selectedIds">) {
  return {
    regions: state.regions,
    search: state.search,
    year: state.year,
    yearRange: state.yearRange,
    countryCodes: state.selectedIds.length ? state.selectedIds : null,
  };
}

export function visibleCountries(index: DatasetIndex, state: Pick<ExplorationSnapshot, "regions" | "search">) {
  return filterCountries(index, { regions: state.regions, search: state.search });
}

export function yearRows(index: DatasetIndex, state: Pick<ExplorationSnapshot, "regions" | "search" | "year">) {
  return filterObservations(index, {
    year: state.year,
    regions: state.regions,
    search: state.search,
  });
}

export function metricValue(row: { [key: string]: number | string | null }, metric: MetricId): number | null {
  const value = row[metric];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
