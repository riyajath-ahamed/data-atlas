import { format } from "d3-format";
import { METRICS, type MetricId } from "../data/schemas/types.ts";

const compact = format("~s");
const decimal = format(",.1f");
const gdp = format(",.0f");
const co2 = format(",.2f");

export function formatMetricValue(metric: MetricId, value: number | null, digits?: "axis"): string {
  if (value == null || !Number.isFinite(value)) return "No data";
  if (digits === "axis") {
    if (metric === "population" || metric === "gdpPerCapita") return compact(value);
    if (metric === "co2PerCapita") return co2(value);
    return decimal(value);
  }
  switch (metric) {
    case "population":
      return compact(value);
    case "gdpPerCapita":
      return `$${gdp(value)}`;
    case "lifeExpectancy":
      return `${decimal(value)} years`;
    case "internetPenetration":
    case "renewableEnergyShare":
      return `${decimal(value)}%`;
    case "co2PerCapita":
      return `${co2(value)} t`;
  }
}

export function metricLabel(metric: MetricId): string {
  return `${METRICS[metric].shortName} (${METRICS[metric].unit})`;
}

export const REGION_COLORS: Record<string, string> = {
  "East Asia & Pacific": "#1c2b42",
  "Europe & Central Asia": "#2c4a6e",
  "Latin America & Caribbean": "#4d6d8c",
  "Middle East, North Africa, Afghanistan & Pakistan": "#6d8298",
  "North America": "#101214",
  "South Asia": "#8aa0b5",
  "Sub-Saharan Africa": "#7a8b9c",
};

export function regionColor(region: string): string {
  return REGION_COLORS[region] ?? "#5c6b7a";
}
