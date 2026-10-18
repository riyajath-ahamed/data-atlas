import { csvParseRows } from "d3-dsv";
import type { CountryMetadata, CountryObservation, ValidationIssue } from "../schemas/types.ts";
import { validateCountries, validateObservation } from "../validation/validate.ts";

const HEADER = [
  "countryCode",
  "year",
  "population",
  "gdpPerCapita",
  "lifeExpectancy",
  "internetPenetration",
  "co2PerCapita",
  "renewableEnergyShare",
] as const;

export interface ParseResult {
  observations: CountryObservation[];
  issues: ValidationIssue[];
}

function parseNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : Number.NaN;
}

export function parseObservations(csv: string): ParseResult {
  const issues: ValidationIssue[] = [];
  const table = csvParseRows(csv.trim());
  if (table.length === 0) {
    return { observations: [], issues: [{ level: "error", message: "The observation file is empty." }] };
  }
  const header = table[0] ?? [];
  if (header.join(",") !== HEADER.join(",")) {
    issues.push({
      level: "error",
      message: `Unexpected header. Expected ${HEADER.join(",")}.`,
    });
    return { observations: [], issues };
  }

  const observations: CountryObservation[] = [];
  const seen = new Set<string>();
  table.slice(1).forEach((cells, index) => {
    const rowNumber = index + 2;
    if (cells.every((cell) => cell.trim() === "")) return;
    const numeric = {
      population: parseNumber(cells[2] ?? ""),
      gdpPerCapita: parseNumber(cells[3] ?? ""),
      lifeExpectancy: parseNumber(cells[4] ?? ""),
      internetPenetration: parseNumber(cells[5] ?? ""),
      co2PerCapita: parseNumber(cells[6] ?? ""),
      renewableEnergyShare: parseNumber(cells[7] ?? ""),
    };
    const observation: CountryObservation = {
      countryCode: (cells[0] ?? "").trim(),
      year: Number((cells[1] ?? "").trim()),
      population: Number.isNaN(numeric.population) ? null : numeric.population,
      gdpPerCapita: Number.isNaN(numeric.gdpPerCapita) ? null : numeric.gdpPerCapita,
      lifeExpectancy: Number.isNaN(numeric.lifeExpectancy) ? null : numeric.lifeExpectancy,
      internetPenetration: Number.isNaN(numeric.internetPenetration) ? null : numeric.internetPenetration,
      co2PerCapita: Number.isNaN(numeric.co2PerCapita) ? null : numeric.co2PerCapita,
      renewableEnergyShare: Number.isNaN(numeric.renewableEnergyShare) ? null : numeric.renewableEnergyShare,
    };
    for (const [key, value] of Object.entries(numeric)) {
      if (Number.isNaN(value)) {
        issues.push({ level: "error", message: `${key} is not a number at row ${rowNumber}`, row: rowNumber });
      }
    }
    const key = `${observation.countryCode}|${observation.year}`;
    if (seen.has(key)) {
      issues.push({
        level: "warning",
        message: `Duplicate observation for ${key} at row ${rowNumber}. The first row is kept.`,
        row: rowNumber,
      });
      return;
    }
    seen.add(key);
    issues.push(...validateObservation(observation, rowNumber));
    observations.push(observation);
  });

  if (issues.some((issue) => issue.level === "error")) {
    return { observations: [], issues };
  }
  return { observations, issues };
}

export function assertValidCountries(countries: CountryMetadata[]): ValidationIssue[] {
  const issues = validateCountries(countries);
  if (issues.some((issue) => issue.level === "error")) {
    throw new Error(issues.map((issue) => issue.message).join("\n"));
  }
  return issues;
}
