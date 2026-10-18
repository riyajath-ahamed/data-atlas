import { METRIC_IDS, type CountryMetadata, type CountryObservation, type ValidationIssue } from "../schemas/types.ts";

const COUNTRY_CODE = /^[A-Z]{3}$/;

function isNullableNumber(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

export function validateObservation(row: CountryObservation, rowIndex?: number): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const at = rowIndex == null ? "" : ` at row ${rowIndex}`;
  if (!COUNTRY_CODE.test(row.countryCode)) {
    issues.push({ level: "error", message: `Invalid country code "${row.countryCode}"${at}`, row: rowIndex });
  }
  if (!Number.isInteger(row.year) || row.year < 1900 || row.year > 2100) {
    issues.push({ level: "error", message: `Invalid year "${String(row.year)}"${at}`, row: rowIndex });
  }
  for (const metric of METRIC_IDS) {
    const value = row[metric];
    if (!isNullableNumber(value)) {
      issues.push({ level: "error", message: `${metric} must be a finite number or null${at}`, row: rowIndex });
    }
  }
  if (row.population != null && row.population < 0) {
    issues.push({ level: "error", message: `Population cannot be negative${at}`, row: rowIndex });
  }
  for (const metric of ["internetPenetration", "renewableEnergyShare"] as const) {
    const value = row[metric];
    if (value != null && (value < 0 || value > 100)) {
      issues.push({
        level: "warning",
        message: `${metric} is outside 0–100 (${value})${at}. The value is kept.`,
        row: rowIndex,
      });
    }
  }
  return issues;
}

export function validateCountries(countries: CountryMetadata[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();
  countries.forEach((country, index) => {
    if (!COUNTRY_CODE.test(country.countryCode)) {
      issues.push({ level: "error", message: `Invalid country code "${country.countryCode}"`, row: index });
    }
    if (!country.name.trim() || !country.region.trim()) {
      issues.push({ level: "error", message: `Country ${country.countryCode} is missing a name or region`, row: index });
    }
    if (seen.has(country.countryCode)) {
      issues.push({ level: "error", message: `Duplicate country metadata for ${country.countryCode}`, row: index });
    }
    seen.add(country.countryCode);
  });
  return issues;
}
