import { METRICS, METRIC_IDS, type CountryMetadata, type CountryObservation, type DatasetMeta, type MetricId } from "../schemas/types.ts";

const YEAR_START = 1990;

export interface WorldBankCountryRow {
  id: string;
  name: string;
  region?: { id?: string; value?: string };
  incomeLevel?: { value?: string };
}

export interface WorldBankValueRow {
  countryiso3code: string;
  date: string;
  value: number | string | null;
}

export interface AssembledSample {
  countries: CountryMetadata[];
  observations: CountryObservation[];
  meta: DatasetMeta;
}

interface AssembleOptions {
  countryRows: readonly WorldBankCountryRow[];
  indicatorRows: Record<MetricId, readonly WorldBankValueRow[]>;
  isoByCode: ReadonlyMap<string, string | null>;
  retrieved: string;
  minimumValues?: number;
  minimumYearCoverage?: number;
}

export function assembleWorldBankSample(options: AssembleOptions): AssembledSample {
  const minimumValues = options.minimumValues ?? 500;
  const minimumYearCoverage = options.minimumYearCoverage ?? 120;
  const countries = options.countryRows
    .filter((country) => country.region?.id && country.region.id !== "NA" && /^[A-Z]{3}$/.test(country.id))
    .map((country) => ({
      countryCode: country.id,
      name: country.name,
      region: country.region?.value ?? "",
      incomeGroup: country.incomeLevel?.value && country.incomeLevel.value !== "Aggregates" ? country.incomeLevel.value : null,
      isoNumeric: options.isoByCode.get(country.id) ?? null,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));

  const countryCodes = new Set(countries.map((country) => country.countryCode));
  const observations = new Map<string, CountryObservation>();

  for (const metric of METRIC_IDS) {
    let kept = 0;
    for (const row of options.indicatorRows[metric]) {
      if (!countryCodes.has(row.countryiso3code) || row.value == null || row.value === "") continue;
      const year = Number(row.date);
      const value = typeof row.value === "number" ? row.value : Number(row.value);
      if (!Number.isInteger(year) || !Number.isFinite(value)) continue;
      const key = `${row.countryiso3code}|${year}`;
      const existing = observations.get(key) ?? emptyObservation(row.countryiso3code, year);
      existing[metric] = value;
      observations.set(key, existing);
      kept += 1;
    }
    if (kept < minimumValues) {
      throw new Error(`${METRICS[metric].code} produced only ${kept} country observations.`);
    }
  }

  const observationRows = [...observations.values()].sort((left, right) =>
    left.countryCode === right.countryCode ? left.year - right.year : left.countryCode.localeCompare(right.countryCode),
  );
  const coverage = new Map<number, number>();
  for (const row of observationRows) {
    if (row.lifeExpectancy == null) continue;
    coverage.set(row.year, (coverage.get(row.year) ?? 0) + 1);
  }
  const defaultYear = [...coverage.entries()]
    .filter(([, count]) => count >= minimumYearCoverage)
    .map(([year]) => year)
    .sort((left, right) => left - right)
    .at(-1);
  if (defaultYear == null) {
    throw new Error(`No year has life expectancy for at least ${minimumYearCoverage} countries.`);
  }

  const usa = observationRows.find((row) => row.countryCode === "USA" && row.year === 2019);
  if (!usa || usa.population == null || usa.population < 300_000_000 || usa.population > 360_000_000) {
    throw new Error(`USA 2019 population failed the sanity check: ${usa?.population ?? "missing"}.`);
  }
  if (usa.lifeExpectancy == null || usa.lifeExpectancy < 70 || usa.lifeExpectancy > 90) {
    throw new Error(`USA 2019 life expectancy failed the sanity check: ${usa.lifeExpectancy}.`);
  }

  const yearEnd = Math.max(...observationRows.map((row) => row.year));
  return {
    countries,
    observations: observationRows,
    meta: {
      id: "world-bank-wdi",
      name: "World Bank World Development Indicators",
      retrieved: options.retrieved,
      yearStart: YEAR_START,
      yearEnd,
      defaultYear,
      observationCount: observationRows.length,
      countryCount: countries.length,
      indicators: Object.fromEntries(
        METRIC_IDS.map((metric) => [metric, { code: METRICS[metric].code, name: METRICS[metric].name, unit: METRICS[metric].unit }]),
      ) as DatasetMeta["indicators"],
      sources: [
        {
          name: "World Bank Open Data, World Development Indicators",
          url: "https://data.worldbank.org/",
          accessed: options.retrieved,
        },
      ],
      unmatchedGeometryIds: [],
      countriesWithoutGeometry: [],
    },
  };
}

export async function fetchWorldBankSample(options: {
  isoByCode: ReadonlyMap<string, string | null>;
  onProgress?: (message: string) => void;
  signal?: AbortSignal;
}): Promise<AssembledSample> {
  const yearEnd = new Date().getFullYear();
  options.onProgress?.("Fetching the country list…");
  const countryPayload = await fetchJson(
    "https://api.worldbank.org/v2/country?format=json&per_page=400",
    options.signal,
  );
  const countryRows = worldBankRows(countryPayload, "countries") as WorldBankCountryRow[];
  const indicatorRows = {} as Record<MetricId, WorldBankValueRow[]>;
  for (const metric of METRIC_IDS) {
    const code = METRICS[metric].code;
    options.onProgress?.(`Fetching ${METRICS[metric].shortName}…`);
    indicatorRows[metric] = await fetchIndicator(code, yearEnd, options.signal);
  }
  options.onProgress?.("Checking the downloaded values…");
  return assembleWorldBankSample({
    countryRows,
    indicatorRows,
    isoByCode: options.isoByCode,
    retrieved: new Date().toISOString().slice(0, 10),
  });
}

async function fetchIndicator(code: string, yearEnd: number, signal?: AbortSignal): Promise<WorldBankValueRow[]> {
  const rows: WorldBankValueRow[] = [];
  let page = 1;
  let pages = 1;
  while (page <= pages) {
    const url = `https://api.worldbank.org/v2/country/all/indicator/${code}?format=json&per_page=5000&date=${YEAR_START}:${yearEnd}&page=${page}`;
    const payload = await fetchJson(url, signal);
    const header = worldBankHeader(payload, code);
    pages = header;
    rows.push(...(worldBankRows(payload, code) as WorldBankValueRow[]));
    page += 1;
  }
  return rows;
}

async function fetchJson(url: string, signal?: AbortSignal): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, { signal, headers: { Accept: "application/json" } });
  } catch (caught) {
    if (caught instanceof DOMException && caught.name === "AbortError") throw caught;
    throw new Error("The World Bank request did not complete. The bundled sample is still loaded.");
  }
  if (!response.ok) {
    throw new Error(`World Bank responded ${response.status} for ${url}. The bundled sample is still loaded.`);
  }
  return response.json();
}

function worldBankHeader(payload: unknown, label: string): number {
  if (!Array.isArray(payload) || payload[0] == null || typeof payload[0] !== "object") {
    throw new Error(`Unexpected World Bank payload for ${label}.`);
  }
  const pages = (payload[0] as { pages?: number }).pages;
  return typeof pages === "number" && pages > 0 ? pages : 1;
}

function worldBankRows(payload: unknown, label: string): unknown[] {
  if (!Array.isArray(payload) || !Array.isArray(payload[1])) {
    const preview = JSON.stringify(payload).slice(0, 240);
    throw new Error(`Unexpected World Bank payload for ${label}: ${preview}`);
  }
  return payload[1];
}

function emptyObservation(countryCode: string, year: number): CountryObservation {
  return {
    countryCode,
    year,
    population: null,
    gdpPerCapita: null,
    lifeExpectancy: null,
    internetPenetration: null,
    co2PerCapita: null,
    renewableEnergyShare: null,
  };
}
