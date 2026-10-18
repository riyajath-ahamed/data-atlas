import { csvFormat } from "d3-dsv";
import type { CountryObservation } from "../data/schemas/types.ts";
import type { DatasetIndex } from "../engine/indexing/buildIndex.ts";
import { filterObservations, type FilterQuery } from "../engine/transforms/filter.ts";

export function observationsToCsv(index: DatasetIndex, rows: readonly CountryObservation[]): string {
  return csvFormat(
    rows.map((row) => {
      const country = index.countryByCode.get(row.countryCode);
      return {
        countryCode: row.countryCode,
        country: country?.name ?? "",
        region: country?.region ?? "",
        incomeGroup: country?.incomeGroup ?? "",
        year: row.year,
        population: row.population,
        gdpPerCapita: row.gdpPerCapita,
        lifeExpectancy: row.lifeExpectancy,
        internetPenetration: row.internetPenetration,
        co2PerCapita: row.co2PerCapita,
        renewableEnergyShare: row.renewableEnergyShare,
      };
    }),
  );
}

export function downloadFilteredCsv(index: DatasetIndex, query: FilterQuery): number {
  const rows = filterObservations(index, query);
  const csv = observationsToCsv(index, rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "data-atlas-filtered.csv";
  link.click();
  URL.revokeObjectURL(url);
  return rows.length;
}
