import { axisBottom, axisLeft } from "d3-axis";
import { brushX, type BrushBehavior } from "d3-brush";
import { pointer, select } from "d3-selection";
import { scaleLinear } from "d3-scale";
import { area, line } from "d3-shape";
import { useEffect, useMemo, useRef, useState } from "react";
import { METRICS, type MetricId } from "../../data/schemas/types.ts";
import { populationWeightedMean } from "../../engine/aggregation/aggregate.ts";
import { validateVisualizationConfig } from "../../engine/visualization-registry/validateConfig.ts";
import { paddedDomain } from "../../engine/transforms/domains.ts";
import { useElementSize, usePrefersReducedMotion } from "../../hooks/useElementSize.ts";
import { useDataset } from "../../app/dataset.tsx";
import { useExplorationStore } from "../../state/exploration-store.ts";
import { formatMetricValue, metricLabel, regionColor } from "../../utils/format.ts";
import { ChartFrame, ConfigError, EmptyState } from "../../components/layout/ChartFrame.tsx";
import { ChartTooltip } from "../../components/tooltips/ChartTooltip.tsx";

const SERIES_COLORS = ["#101214", "#1c2b42", "#2c4a6e", "#4d6d8c", "#6d8298", "#8aa0b5", "#c5d0db", "#5c6b7a"];
const selectClass = "field text-[11px]";

interface Point {
  year: number;
  value: number | null;
}
interface Series {
  id: string;
  label: string;
  color: string;
  points: Point[];
}

export function Timeline() {
  const dataset = useDataset();
  const metric = useExplorationStore((state) => state.timelineMetric);
  const mode = useExplorationStore((state) => state.timelineMode);
  const year = useExplorationStore((state) => state.year);
  const yearRange = useExplorationStore((state) => state.yearRange);
  const selectedIds = useExplorationStore((state) => state.selectedIds);
  const regions = useExplorationStore((state) => state.regions);
  const playing = useExplorationStore((state) => state.playing);
  const setTimelineMetric = useExplorationStore((state) => state.setTimelineMetric);
  const setTimelineMode = useExplorationStore((state) => state.setTimelineMode);
  const setPlaying = useExplorationStore((state) => state.setPlaying);
  const reduced = usePrefersReducedMotion();
  const validation = validateVisualizationConfig({ type: "timeline", metric, representation: mode });

  const series = useMemo(() => buildSeries(dataset.index, metric, selectedIds, regions), [dataset, metric, selectedIds, regions]);
  const frameRef = useRef<HTMLDivElement>(null);
  const size = useElementSize(frameRef);
  const [tip, setTip] = useState<{ left: number; top: number; year: number; rows: { label: string; value: number | null; color: string }[] } | null>(null);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last = performance.now();
    const interval = reduced ? 900 : 700;
    const tick = (now: number) => {
      if (now - last >= interval) {
        last = now;
        const advanced = useExplorationStore.getState().stepYear();
        if (!advanced) useExplorationStore.getState().setPlaying(false);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, reduced]);

  const note = selectedIds.length
    ? `Selected countries. Brush the plot to set the shared year range. The marker is ${year}.`
    : `Population-weighted regional means. Countries missing the metric or population are omitted, not treated as zero.`;

  return (
    <ChartFrame
      title="Temporal explorer"
      note={note}
      testId="timeline-panel"
      focus="timeline"
      toolbar={
        <>
          <label className="flex items-center gap-1 text-[11px] text-muted">
            Metric
            <select data-testid="timeline-metric" className={selectClass} value={metric} onChange={(event) => setTimelineMetric(event.target.value as MetricId)}>
              {Object.values(METRICS).map((item) => (
                <option key={item.id} value={item.id}>{item.shortName}</option>
              ))}
            </select>
          </label>
          <button type="button" className={selectClass} onClick={() => setTimelineMode(mode === "line" ? "area" : "line")}>
            {mode === "line" ? "Line" : "Area"}
          </button>
          <button
            type="button"
            data-testid="timeline-play"
            className={selectClass}
            onClick={() => {
              if (playing) {
                setPlaying(false);
                return;
              }
              const state = useExplorationStore.getState();
              if (state.year >= state.yearRange[1]) state.setYear(state.yearRange[0]);
              setPlaying(true);
            }}
          >
            {playing ? "Pause" : "Play"}
          </button>
          <button
            type="button"
            className={selectClass}
            onClick={() => {
              setPlaying(false);
              useExplorationStore.getState().setYear(yearRange[0]);
            }}
          >
            Reset year
          </button>
        </>
      }
    >
      {!validation.ok ? (
        <ConfigError errors={validation.errors} />
      ) : series.every((item) => item.points.every((point) => point.value == null)) ? (
        <EmptyState title="No time series" detail="The current filter has no observations for this metric." />
      ) : (
        <div ref={frameRef} className="absolute inset-0">
          <TimelineSvg
            series={series}
            width={size.width}
            height={size.height}
            metric={metric}
            mode={mode}
            yearRange={yearRange}
            onTip={setTip}
          />
          {tip ? (
            <ChartTooltip x={tip.left} y={tip.top}>
              <p className="font-medium text-ink">{tip.year}</p>
              {tip.rows.map((row) => (
                <p key={row.label} style={{ color: row.color }}>
                  {row.label}: {formatMetricValue(metric, row.value)}
                </p>
              ))}
            </ChartTooltip>
          ) : null}
        </div>
      )}
    </ChartFrame>
  );
}

function buildSeries(
  index: ReturnType<typeof useDataset>["index"],
  metric: MetricId,
  selectedIds: string[],
  regions: string[],
): Series[] {
  const years = index.years;
  if (selectedIds.length) {
    return selectedIds.slice(0, 8).map((countryCode, position) => {
      const country = index.countryByCode.get(countryCode);
      const byYear = new Map((index.byCountry.get(countryCode) ?? []).map((row) => [row.year, row[metric]]));
      return {
        id: countryCode,
        label: country?.name ?? countryCode,
        color: SERIES_COLORS[position % SERIES_COLORS.length] ?? "#8d97a6",
        points: years.map((year) => ({ year, value: byYear.get(year) ?? null })),
      };
    });
  }
  const regionNames = regions.length ? regions : index.regions;
  return regionNames.map((region) => ({
    id: region,
    label: region,
    color: regionColor(region),
    points: years.map((year) => ({ year, value: populationWeightedMean(index, region, year, metric).value })),
  }));
}

function TimelineSvg({
  series,
  width,
  height,
  metric,
  mode,
  yearRange,
  onTip,
}: {
  series: Series[];
  width: number;
  height: number;
  metric: MetricId;
  mode: "line" | "area";
  yearRange: [number, number];
  onTip: (tip: { left: number; top: number; year: number; rows: { label: string; value: number | null; color: string }[] } | null) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svgElement = svgRef.current;
    if (!svgElement || width < 80 || height < 80) return;
    const margin = { top: 12, right: 16, bottom: 36, left: 58 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    if (innerWidth < 40 || innerHeight < 40) return;
    const values = series.flatMap((item) => item.points.map((point) => point.value)).filter((value): value is number => value != null);
    const yDomain = paddedDomain(values, "linear");
    const years = series[0]?.points.map((point) => point.year) ?? [];
    if (!yDomain || years.length === 0) return;
    const x = scaleLinear()
      .domain([years[0] ?? 1990, years[years.length - 1] ?? 2023])
      .range([0, innerWidth]);
    const y = scaleLinear().domain(yDomain).range([innerHeight, 0]).nice();
    const svg = select(svgElement);
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${width} ${height}`);
    const plot = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    plot.append("g").attr("transform", `translate(0,${innerHeight})`).call(axisBottom(x).ticks(6).tickFormat((value) => String(Math.round(Number(value)))));
    plot.append("g").call(axisLeft(y).ticks(5).tickFormat((value) => formatMetricValue(metric, Number(value), "axis")));
    const lineGen = line<Point>()
      .defined((point) => point.value != null)
      .x((point) => x(point.year))
      .y((point) => y(point.value ?? 0));
    const areaGen = area<Point>()
      .defined((point) => point.value != null)
      .x((point) => x(point.year))
      .y0(innerHeight)
      .y1((point) => y(point.value ?? 0));
    for (const item of series) {
      if (mode === "area") {
        plot.append("path").attr("d", areaGen(item.points)).attr("fill", item.color).attr("opacity", 0.18);
      }
      plot.append("path").attr("d", lineGen(item.points)).attr("fill", "none").attr("stroke", item.color).attr("stroke-width", 1.6);
    }
    const rule = plot.append("line").attr("class", "year-rule").attr("y1", 0).attr("y2", innerHeight).attr("stroke", "var(--select)").attr("stroke-width", 1);
    const placeRule = () => {
      const position = x(useExplorationStore.getState().year);
      rule.attr("x1", position).attr("x2", position);
    };
    placeRule();
    let silent = false;
    const brushBehavior: BrushBehavior<unknown> = brushX<unknown>()
      .extent([
        [0, 0],
        [innerWidth, innerHeight],
      ])
      .on("end", (event) => {
        if (silent || !event.sourceEvent || !event.selection) return;
        const [x0, x1] = event.selection as [number, number];
        if (Math.abs(x1 - x0) < 12) return;
        const state = useExplorationStore.getState();
        const from = Math.round(x.invert(Math.min(x0, x1)));
        const to = Math.round(x.invert(Math.max(x0, x1)));
        const nextFrom = Math.max(state.yearMin, Math.min(from, to));
        const nextTo = Math.min(state.yearMax, Math.max(from, to));
        if (nextTo - nextFrom < 1) return;
        state.setYearRange([nextFrom, nextTo]);
      });
    const brushGroup = plot.append("g").attr("class", "timeline-brush");
    silent = true;
    brushGroup.call(brushBehavior);
    const extent = useExplorationStore.getState();
    const coversAll = yearRange[0] <= extent.yearMin && yearRange[1] >= extent.yearMax;
    const start = x(yearRange[0]);
    const end = x(yearRange[1]);
    if (!coversAll && Number.isFinite(start) && Number.isFinite(end) && end - start >= 12) {
      brushGroup.call(brushBehavior.move, [start, end]);
    }
    silent = false;
    plot
      .append("rect")
      .attr("class", "timeline-overlay")
      .attr("width", innerWidth)
      .attr("height", innerHeight)
      .attr("fill", "transparent")
      .attr("pointer-events", "none");
    svg.on("pointermove.tip", (event) => {
      const [px] = pointer(event, plot.node() ?? svgElement);
      const hoveredYear = Math.round(x.invert(px));
      const rows = series.map((item) => ({
        label: item.label,
        color: item.color,
        value: item.points.find((point) => point.year === hoveredYear)?.value ?? null,
      }));
      const rect = svgElement.getBoundingClientRect();
      onTip({
        year: hoveredYear,
        rows,
        left: Math.min(event.clientX - rect.left + 12, width - 200),
        top: 12,
      });
    });
    svg.on("pointerleave.tip", () => onTip(null));
    const unsubscribe = useExplorationStore.subscribe((state, previous) => {
      if (state.year !== previous.year) placeRule();
    });
    return () => {
      unsubscribe();
      svg.on("pointermove.tip", null);
      svg.on("pointerleave.tip", null);
      brushBehavior.on("start", null).on("brush", null).on("end", null);
      svg.selectAll("*").remove();
    };
  }, [series, width, height, metric, mode, yearRange, onTip]);

  return (
    <svg
      ref={svgRef}
      data-testid="timeline-svg"
      className="chart-svg absolute inset-0 h-full w-full"
      role="img"
      aria-label={`Time series of ${metricLabel(metric)}.`}
    />
  );
}
