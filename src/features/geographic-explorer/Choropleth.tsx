import { geoEqualEarth, geoGraticule10, geoPath } from "d3-geo";
import { select } from "d3-selection";
import { scaleDiverging, scaleSequential } from "d3-scale";
import { interpolateRdBu, interpolateYlGnBu } from "d3-scale-chromatic";
import { quantile } from "d3-array";
import { zoom, zoomIdentity } from "d3-zoom";
import { useEffect, useMemo, useRef, useState } from "react";
import { METRICS, type MetricId } from "../../data/schemas/types.ts";
import type { CountryShape } from "../../data/geo.ts";
import type { DatasetIndex } from "../../engine/indexing/buildIndex.ts";
import { validateVisualizationConfig } from "../../engine/visualization-registry/validateConfig.ts";
import { useElementSize } from "../../hooks/useElementSize.ts";
import { useDataset } from "../../app/dataset.tsx";
import { countryPasses } from "../../engine/transforms/filter.ts";
import { useExplorationStore } from "../../state/exploration-store.ts";
import { useHoverStore } from "../../state/hover-store.ts";
import { yearRows } from "../../state/selectors.ts";
import { formatMetricValue, metricLabel } from "../../utils/format.ts";
import { ChartFrame, ConfigError } from "../../components/layout/ChartFrame.tsx";
import { ContinuousLegend } from "../../components/legends/ColorLegend.tsx";
import { ChartTooltip } from "../../components/tooltips/ChartTooltip.tsx";

const selectClass = "field text-[11px]";

export function Choropleth() {
  const dataset = useDataset();
  const metric = useExplorationStore((state) => state.mapMetric);
  const scheme = useExplorationStore((state) => state.mapScheme);
  const year = useExplorationStore((state) => state.year);
  const regions = useExplorationStore((state) => state.regions);
  const search = useExplorationStore((state) => state.search);
  const setMapMetric = useExplorationStore((state) => state.setMapMetric);
  const setMapScheme = useExplorationStore((state) => state.setMapScheme);
  const validation = validateVisualizationConfig({ type: "choropleth", metric, scheme });
  const rows = useMemo(() => yearRows(dataset.index, { year, regions: [], search: "" }), [dataset, year]);
  const valueByCode = useMemo(() => new Map(rows.map((row) => [row.countryCode, row[metric]])), [rows, metric]);
  const frameRef = useRef<HTMLDivElement>(null);
  const size = useElementSize(frameRef);
  const [tip, setTip] = useState<{ left: number; top: number; code: string } | null>(null);
  const values = [...valueByCode.values()].filter((value): value is number => value != null);
  const low = values.length ? Math.min(...values) : 0;
  const high = values.length ? Math.max(...values) : 1;
  const mid = quantile(values, 0.5) ?? (low + high) / 2;
  const hovered = tip ? dataset.index.countryByCode.get(tip.code) : null;

  return (
    <ChartFrame
      title="Geographic explorer"
      note={`Equal Earth projection, Natural Earth 110m. ${year}. Countries without a value stay unmarked rather than zero.`}
      testId="map-panel"
      focus="map"
      toolbar={
        <>
          <label className="flex items-center gap-1 text-[11px] text-muted">
            Metric
            <select data-testid="map-metric" className={selectClass} value={metric} onChange={(event) => setMapMetric(event.target.value as MetricId)}>
              {Object.values(METRICS).map((item) => (
                <option key={item.id} value={item.id}>{item.shortName}</option>
              ))}
            </select>
          </label>
          <button type="button" className={selectClass} onClick={() => setMapScheme(scheme === "sequential" ? "diverging" : "sequential")}>
            {scheme === "sequential" ? "Sequential" : "Diverging"}
          </button>
        </>
      }
      footer={
        values.length ? (
          <div>
            <ContinuousLegend scheme={scheme} domain={scheme === "diverging" ? [low, high, mid] : [low, high]} metric={metric} />
            <p className="mt-1">
              {scheme === "diverging"
                ? "Diverging color is centered on the median of countries with data, not on a causal baseline."
                : `${values.length} countries colored. Missing countries use the empty fill.`}
            </p>
          </div>
        ) : (
          "No values for this metric in the selected year."
        )
      }
    >
      {!validation.ok ? (
        <ConfigError errors={validation.errors} />
      ) : (
        <div ref={frameRef} className="absolute inset-0">
          <MapSvg
            shapes={dataset.shapes}
            width={size.width}
            height={size.height}
            metric={metric}
            index={dataset.index}
            onTip={setTip}
          />
          {tip && hovered ? (
            <ChartTooltip x={tip.left} y={tip.top}>
              <p className="font-medium text-ink">{hovered.name}</p>
              <p>{hovered.region}</p>
              <p>
                {metricLabel(metric)}: {formatMetricValue(metric, valueByCode.get(tip.code) ?? null)}
              </p>
              {!countryPasses(dataset.index, tip.code, { regions, search }) ? <p>Hidden by the current filter.</p> : null}
            </ChartTooltip>
          ) : null}
        </div>
      )}
    </ChartFrame>
  );
}

function MapSvg({
  shapes,
  width,
  height,
  metric,
  index,
  onTip,
}: {
  shapes: CountryShape[];
  width: number;
  height: number;
  metric: MetricId;
  index: DatasetIndex;
  onTip: (tip: { left: number; top: number; code: string } | null) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svgElement = svgRef.current;
    if (!svgElement || width < 80 || height < 80) return;
    const svg = select(svgElement);
    svg.selectAll("*").remove();
    const projection = geoEqualEarth();
    const path = geoPath(projection);
    const collection = { type: "FeatureCollection" as const, features: shapes.map((shape) => shape.feature) };
    projection.fitExtent(
      [
        [8, 8],
        [width - 8, height - 8],
      ],
      collection,
    );
    const drawing = svg.append("g");
    drawing.append("path").datum(geoGraticule10()).attr("d", path).attr("fill", "none").attr("stroke", "var(--line)").attr("stroke-width", 0.4);
    drawing
      .selectAll("path.country")
      .data(shapes)
      .join("path")
      .attr("class", "country")
      .attr("data-code", (shape) => shape.countryCode ?? "")
      .attr("d", (shape) => path(shape.feature))
      .on("pointerenter", (event, shape) => {
        if (!shape.countryCode) return;
        useHoverStore.getState().setHovered(shape.countryCode);
        const rect = svgElement.getBoundingClientRect();
        onTip({
          code: shape.countryCode,
          left: Math.min(event.clientX - rect.left + 12, width - 180),
          top: Math.min(event.clientY - rect.top + 12, height - 72),
        });
      })
      .on("pointerleave", () => {
        useHoverStore.getState().setHovered(null);
        onTip(null);
      })
      .on("click", (event, shape) => {
        event.stopPropagation();
        if (shape.countryCode) useExplorationStore.getState().toggleCountry(shape.countryCode);
      });
    const applyColor = () => {
      const current = useExplorationStore.getState();
      const valueByCode = new Map((index.byYear.get(current.year) ?? []).map((row) => [row.countryCode, row[current.mapMetric]]));
      const values = [...valueByCode.values()].filter((value): value is number => value != null);
      if (values.length === 0) return;
      const low = Math.min(...values);
      const high = Math.max(...values);
      const mid = quantile(values, 0.5) ?? (low + high) / 2;
      const color =
        current.mapScheme === "diverging"
          ? scaleDiverging(interpolateRdBu).domain([low, mid, high])
          : scaleSequential(interpolateYlGnBu).domain([low, high]);
      const selected = new Set(current.selectedIds);
      const hovered = useHoverStore.getState().countryCode;
      drawing.selectAll<SVGPathElement, CountryShape>("path.country").each(function paint(shape) {
        const element = select(this);
        const code = shape.countryCode;
        const value = code ? valueByCode.get(code) : null;
        const visible = code ? countryPasses(index, code, { regions: current.regions, search: current.search }) : false;
        element
          .attr("fill", value == null || !visible ? "var(--missing)" : String(color(value)))
          .attr("opacity", !code || visible || selected.has(code) ? 1 : 0.22)
          .classed("is-selected", Boolean(code && (selected.has(code) || code === hovered)));
      });
    };
    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 8])
      .on("zoom", (event) => {
        drawing.attr("transform", event.transform.toString());
      });
    svg.call(zoomBehavior);
    svg.call(zoomBehavior.transform, zoomIdentity);
    applyColor();
    const unsubscribe = useExplorationStore.subscribe(applyColor);
    const unsubscribeHover = useHoverStore.subscribe(applyColor);
    return () => {
      unsubscribe();
      unsubscribeHover();
      svg.on(".zoom", null);
      svg.selectAll("*").remove();
    };
  }, [shapes, width, height, index, onTip]);

  return (
    <svg
      ref={svgRef}
      data-testid="map-svg"
      className="chart-svg absolute inset-0 h-full w-full"
      role="img"
      aria-label={`World map colored by ${metricLabel(metric)}.`}
    />
  );
}
