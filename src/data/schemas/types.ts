export const METRIC_IDS = [
  "population",
  "gdpPerCapita",
  "lifeExpectancy",
  "internetPenetration",
  "co2PerCapita",
  "renewableEnergyShare",
] as const;

export type MetricId = (typeof METRIC_IDS)[number];

export interface MetricDefinition {
  id: MetricId;
  code: string;
  name: string;
  shortName: string;
  unit: string;
  description: string;
  percent: boolean;
  allowLog: boolean;
}

export const METRICS: Record<MetricId, MetricDefinition> = {
  population: {
    id: "population",
    code: "SP.POP.TOTL",
    name: "Population, total",
    shortName: "Population",
    unit: "people",
    description: "De facto population in the World Bank series, midyear estimates where the source provides them.",
    percent: false,
    allowLog: true,
  },
  gdpPerCapita: {
    id: "gdpPerCapita",
    code: "NY.GDP.PCAP.CD",
    name: "GDP per capita",
    shortName: "GDP per capita",
    unit: "current US$",
    description: "Gross domestic product divided by midyear population, in current US dollars. Not adjusted for inflation.",
    percent: false,
    allowLog: true,
  },
  lifeExpectancy: {
    id: "lifeExpectancy",
    code: "SP.DYN.LE00.IN",
    name: "Life expectancy at birth",
    shortName: "Life expectancy",
    unit: "years",
    description: "Years a newborn would live if prevailing age-specific mortality stayed constant.",
    percent: false,
    allowLog: false,
  },
  internetPenetration: {
    id: "internetPenetration",
    code: "IT.NET.USER.ZS",
    name: "Individuals using the Internet",
    shortName: "Internet use",
    unit: "% of population",
    description: "Share of people who used the Internet in the last three months, as compiled by the World Bank from ITU and national sources.",
    percent: true,
    allowLog: false,
  },
  co2PerCapita: {
    id: "co2PerCapita",
    code: "EN.GHG.CO2.PC.CE.AR5",
    name: "CO2 emissions excluding LULUCF per capita",
    shortName: "CO2 per capita",
    unit: "t CO2e per capita",
    description:
      "World Bank WDI series EN.GHG.CO2.PC.CE.AR5. Annual CO2 from agriculture, energy, waste, and industry, excluding land use, per person. The older fossil-fuel series EN.ATM.CO2E.PC is archived and is not used.",
    percent: false,
    allowLog: true,
  },
  renewableEnergyShare: {
    id: "renewableEnergyShare",
    code: "EG.FEC.RNEW.ZS",
    name: "Renewable energy consumption",
    shortName: "Renewable energy",
    unit: "% of total final energy consumption",
    description: "Renewable energy share of total final energy consumption.",
    percent: true,
    allowLog: false,
  },
};

export interface CountryObservation {
  countryCode: string;
  year: number;
  population: number | null;
  gdpPerCapita: number | null;
  lifeExpectancy: number | null;
  internetPenetration: number | null;
  co2PerCapita: number | null;
  renewableEnergyShare: number | null;
}

export interface CountryMetadata {
  countryCode: string;
  name: string;
  region: string;
  incomeGroup: string | null;
  isoNumeric: string | null;
}

export interface DatasetMeta {
  id: string;
  name: string;
  retrieved: string;
  yearStart: number;
  yearEnd: number;
  defaultYear: number;
  observationCount: number;
  countryCount: number;
  indicators: Record<MetricId, { code: string; name: string; unit: string }>;
  sources: { name: string; url: string; package?: string; accessed?: string }[];
  unmatchedGeometryIds: string[];
  countriesWithoutGeometry: string[];
}

export interface ValidationIssue {
  level: "error" | "warning";
  message: string;
  row?: number;
}

export type ScaleKind = "linear" | "log";

export type ViewId =
  | "overview"
  | "geographic"
  | "scatter"
  | "timeline"
  | "correlation"
  | "relationship"
  | "hierarchy"
  | "table";

export type FocusId = "scatter" | "map" | "timeline" | "correlation" | "network" | "treemap" | "table";
