import { interpolateRdBu, interpolateYlGnBu } from "d3-scale-chromatic";
import { formatMetricValue, regionColor } from "../../utils/format.ts";
import type { MetricId } from "../../data/schemas/types.ts";

export function ContinuousLegend({
  scheme,
  domain,
  metric,
}: {
  scheme: "sequential" | "diverging";
  domain: [number, number, number?];
  metric: MetricId;
}) {
  const interpolator = scheme === "diverging" ? interpolateRdBu : interpolateYlGnBu;
  const stops = Array.from({ length: 9 }, (_, index) => {
    const t = index / 8;
    const colorT = scheme === "diverging" ? 1 - t : t;
    return `${interpolator(colorT)} ${(t * 100).toFixed(0)}%`;
  });
  const low = domain[0];
  const mid = domain[2] ?? (domain[0] + domain[1]) / 2;
  const high = domain[1];
  return (
    <div className="flex items-center gap-2 text-[10px] text-muted">
      <span className="font-mono">{formatMetricValue(metric, low, "axis")}</span>
      <div className="relative h-2 min-w-24 flex-1" style={{ background: `linear-gradient(90deg, ${stops.join(", ")})` }} />
      {scheme === "diverging" ? <span className="font-mono">{formatMetricValue(metric, mid, "axis")}</span> : null}
      <span className="font-mono">{formatMetricValue(metric, high, "axis")}</span>
    </div>
  );
}

export function RegionLegend({ regions }: { regions: string[] }) {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted">
      {regions.map((region) => (
        <li key={region} className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2" style={{ background: regionColor(region) }} />
          {region}
        </li>
      ))}
    </ul>
  );
}
