/**
 * Downloads a bundled World Bank WDI sample and Natural Earth 110m
 * countries (world-atlas). Run once and commit the output. The app does
 * not call these services at runtime.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(root, "src/data/datasets");

const INDICATORS = {
  population: "SP.POP.TOTL",
  gdpPerCapita: "NY.GDP.PCAP.CD",
  lifeExpectancy: "SP.DYN.LE00.IN",
  internetPenetration: "IT.NET.USER.ZS",
  co2PerCapita: "EN.GHG.CO2.PC.CE.AR5",
  renewableEnergyShare: "EG.FEC.RNEW.ZS",
};

const YEAR_START = 1990;
const YEAR_END = 2024;

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "data-atlas-sample-builder",
    },
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} for ${url}`);
  }
  return response.json();
}

async function fetchIndicator(code) {
  const rows = [];
  let page = 1;
  let pages = 1;
  while (page <= pages) {
    const url = `https://api.worldbank.org/v2/country/all/indicator/${code}?format=json&per_page=1000&date=${YEAR_START}:${YEAR_END}&page=${page}`;
    const payload = await fetchJson(url);
    if (!Array.isArray(payload) || !Array.isArray(payload[1])) {
      throw new Error(`Unexpected World Bank payload for ${code}: ${JSON.stringify(payload).slice(0, 240)}`);
    }
    pages = payload[0].pages;
    rows.push(...payload[1]);
    page += 1;
  }
  return rows;
}

function csvCell(value) {
  if (value == null) return "";
  return String(value);
}

await mkdir(outDir, { recursive: true });

const countryPayload = await fetchJson("https://api.worldbank.org/v2/country?format=json&per_page=400");
const countryRows = countryPayload[1].filter((country) => country.region?.id && country.region.id !== "NA");

const isoPayload = await fetchJson(
  "https://raw.githubusercontent.com/lukes/ISO-3166-Countries-with-Regional-Codes/master/all/all.json",
);
const numericByAlpha3 = new Map(
  isoPayload
    .filter((row) => row["alpha-3"] && row["country-code"])
    .map((row) => [row["alpha-3"], String(row["country-code"]).padStart(3, "0")]),
);

const countries = countryRows
  .map((country) => ({
    countryCode: country.id,
    name: country.name,
    region: country.region.value,
    incomeGroup: country.incomeLevel?.value && country.incomeLevel.value !== "Aggregates" ? country.incomeLevel.value : null,
    isoNumeric: numericByAlpha3.get(country.id) ?? null,
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

const countryCodes = new Set(countries.map((country) => country.countryCode));

const observations = new Map();
for (const [field, code] of Object.entries(INDICATORS)) {
  const rows = await fetchIndicator(code);
  let kept = 0;
  for (const row of rows) {
    const countryCode = row.countryiso3code;
    if (!countryCodes.has(countryCode) || row.value == null) continue;
    const year = Number(row.date);
    if (!Number.isInteger(year)) continue;
    const key = `${countryCode}|${year}`;
    const existing = observations.get(key) ?? {
      countryCode,
      year,
      population: null,
      gdpPerCapita: null,
      lifeExpectancy: null,
      internetPenetration: null,
      co2PerCapita: null,
      renewableEnergyShare: null,
    };
    existing[field] = row.value;
    observations.set(key, existing);
    kept += 1;
  }
  if (kept < 500) {
    throw new Error(`Indicator ${code} produced only ${kept} country observations.`);
  }
  console.log(`${code}: ${kept} values`);
}

const observationRows = [...observations.values()].sort((a, b) =>
  a.countryCode === b.countryCode ? a.year - b.year : a.countryCode.localeCompare(b.countryCode),
);

const coverageByYear = new Map();
for (const row of observationRows) {
  if (row.lifeExpectancy == null) continue;
  coverageByYear.set(row.year, (coverageByYear.get(row.year) ?? 0) + 1);
}
const coveredYears = [...coverageByYear.entries()]
  .filter(([, count]) => count >= 120)
  .map(([year]) => year)
  .sort((a, b) => a - b);
const defaultYear = coveredYears.at(-1);
if (defaultYear == null) {
  throw new Error("Could not find a year with life expectancy for at least 120 countries.");
}

const usa = observationRows.find((row) => row.countryCode === "USA" && row.year === 2019);
if (!usa || usa.population < 300_000_000 || usa.population > 360_000_000) {
  throw new Error(`USA 2019 population failed sanity check: ${usa?.population}`);
}
if (!usa.lifeExpectancy || usa.lifeExpectancy < 70 || usa.lifeExpectancy > 90) {
  throw new Error(`USA 2019 life expectancy failed sanity check: ${usa.lifeExpectancy}`);
}

const topoResponse = await fetch("https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json", {
  headers: { "User-Agent": "data-atlas-sample-builder" },
});
if (!topoResponse.ok) throw new Error(`world-atlas download failed: ${topoResponse.status}`);
const topology = await topoResponse.json();
const geometries = topology.objects?.countries?.geometries;
if (!Array.isArray(geometries) || geometries.length < 100) {
  throw new Error("world-atlas countries object is missing geometries.");
}

const numericToCode = new Map(
  countries.filter((country) => country.isoNumeric).map((country) => [String(Number(country.isoNumeric)), country.countryCode]),
);
const unmatchedGeometries = geometries
  .map((geometry) => String(geometry.id))
  .filter((id) => id !== "-99" && !numericToCode.has(String(Number(id))));
const matchedCodes = new Set(
  geometries.map((geometry) => numericToCode.get(String(Number(geometry.id)))).filter(Boolean),
);
const countriesWithoutGeometry = countries
  .filter((country) => !matchedCodes.has(country.countryCode))
  .map((country) => country.countryCode);

const header = "countryCode,year,population,gdpPerCapita,lifeExpectancy,internetPenetration,co2PerCapita,renewableEnergyShare";
const csv = [
  header,
  ...observationRows.map((row) =>
    [
      row.countryCode,
      row.year,
      csvCell(row.population),
      csvCell(row.gdpPerCapita),
      csvCell(row.lifeExpectancy),
      csvCell(row.internetPenetration),
      csvCell(row.co2PerCapita),
      csvCell(row.renewableEnergyShare),
    ].join(","),
  ),
].join("\n");

const meta = {
  id: "world-bank-wdi",
  name: "World Bank World Development Indicators",
  retrieved: new Date().toISOString().slice(0, 10),
  yearStart: YEAR_START,
  yearEnd: Math.max(...observationRows.map((row) => row.year)),
  defaultYear,
  observationCount: observationRows.length,
  countryCount: countries.length,
  indicators: {
    population: { code: "SP.POP.TOTL", name: "Population, total", unit: "people" },
    gdpPerCapita: { code: "NY.GDP.PCAP.CD", name: "GDP per capita", unit: "current US$" },
    lifeExpectancy: { code: "SP.DYN.LE00.IN", name: "Life expectancy at birth", unit: "years" },
    internetPenetration: { code: "IT.NET.USER.ZS", name: "Individuals using the Internet", unit: "% of population" },
    co2PerCapita: {
      code: "EN.GHG.CO2.PC.CE.AR5",
      name: "CO2 emissions excluding LULUCF per capita",
      unit: "t CO2e per capita",
    },
    renewableEnergyShare: {
      code: "EG.FEC.RNEW.ZS",
      name: "Renewable energy consumption",
      unit: "% of total final energy consumption",
    },
  },
  sources: [
    {
      name: "World Bank Open Data, World Development Indicators",
      url: "https://data.worldbank.org/",
      accessed: new Date().toISOString().slice(0, 10),
    },
    {
      name: "Natural Earth 1:110m cultural vectors, via world-atlas 2.0.2",
      url: "https://www.naturalearthdata.com/",
      package: "https://github.com/topojson/world-atlas",
    },
    {
      name: "ISO 3166-1 numeric codes",
      url: "https://github.com/lukes/ISO-3166-Countries-with-Regional-Codes",
    },
  ],
  unmatchedGeometryIds: unmatchedGeometries,
  countriesWithoutGeometry,
};

await writeFile(resolve(outDir, "observations.csv"), `${csv}\n`);
await writeFile(resolve(outDir, "countries.json"), `${JSON.stringify(countries, null, 2)}\n`);
await writeFile(resolve(outDir, "meta.json"), `${JSON.stringify(meta, null, 2)}\n`);
await writeFile(resolve(outDir, "countries-110m.json"), `${JSON.stringify(topology)}\n`);

console.log(`Wrote ${observationRows.length} observations for ${countries.length} countries.`);
console.log(`Default year ${defaultYear}. Geometries without a country match: ${unmatchedGeometries.length}. Countries without geometry: ${countriesWithoutGeometry.length}.`);
