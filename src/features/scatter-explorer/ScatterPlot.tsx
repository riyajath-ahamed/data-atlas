import { axisBottom, axisLeft } from "d3-axis";
import { pointer, select } from "d3-selection";
import { scaleLinear, scaleLog, scaleSqrt } from "d3-scale";
import { brush, type BrushBehavior } from "d3-brush";
import { zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from "d3-zoom";
import { useEffect, useMemo, useRef, useState } from "react";
import { METRICS, type MetricId } from "../../data/schemas/types.ts";
import { validateVisualizationConfig } from "../../engine/visualization-registry/validateConfig.ts";
import { buildPointIndex, findNearest } from "../../engine/indexing/quadtreeIndex.ts";
import { iqrFences, isOutsideFences } from "../../engine/statistics/outliers.ts";
import { linearRegression } from "../../engine/statistics/regression.ts";
import { finiteValues, paddedDomain } from "../../engine/transforms/domains.ts";
import { useElementSize } from "../../hooks/useElementSize.ts";
import { useDataset } from "../../app/dataset.tsx";
import { yearRows } from "../../state/selectors.ts";
import { useExplorationStore } from "../../state/exploration-store.ts";
import { useHoverStore } from "../../state/hover-store.ts";
import { formatMetricValue, metricLabel, regionColor } from "../../utils/format.ts";
import { ChartFrame, ConfigError, EmptyState } from "../../components/layout/ChartFrame.tsx";
import { RegionLegend } from "../../components/legends/ColorLegend.tsx";
import { ChartTooltip } from "../../components/tooltips/ChartTooltip.tsx";

export const CANVAS_THRESHOLD = 1500;

function decadeTicks(domain: readonly number[]): number[] | null {
  const low = Math.min(domain[0] ?? 0, domain[1] ?? 0);
  const high = Math.max(domain[0] ?? 0, domain[1] ?? 0);
  if (!(low > 0) || !(high > low)) return null;
  const start = Math.ceil(Math.log10(low) - 1e-6);
  const end = Math.floor(Math.log10(high) + 1e-6);
  const values: number[] = [];
  for (let exponent = start; exponent <= end; exponent += 1) values.push(10 ** exponent);
  return values.length >= 2 ? values : null;
}

interface Mark {
  countryCode: string;
  name: string;
  region: string;
  xValue: number;
  yValue: number;
  sizeValue: number | null;
  outlier: boolean;
}

interface Tip {
  mark: Mark;
  left: number;
  top: number;
}

const selectClass = "field text-[11px]";

export function ScatterPlot() {
  const dataset = useDataset();
  const scatterX = useExplorationStore((state) => state.scatterX);
  const scatterY = useExplorationStore((state) => state.scatterY);
  const scatterSize = useExplorationStore((state) => state.scatterSize);
  const scaleX = useExplorationStore((state) => state.scaleX);
  const scaleY = useExplorationStore((state) => state.scaleY);
  const opacity = useExplorationStore((state) => state.opacity);
  const showRegression = useExplorationStore((state) => state.showRegression);
  const scatterMode = useExplorationStore((state) => state.scatterMode);
  const year = useExplorationStore((state) => state.year);
  const regions = useExplorationStore((state) => state.regions);
  const search = useExplorationStore((state) => state.search);
  const selectedIds = useExplorationStore((state) => state.selectedIds);
  const setScatterX = useExplorationStore((state) => state.setScatterX);
  const setScatterY = useExplorationStore((state) => state.setScatterY);
  const setScatterSize = useExplorationStore((state) => state.setScatterSize);
  const setScaleX = useExplorationStore((state) => state.setScaleX);
  const setScaleY = useExplorationStore((state) => state.setScaleY);
  const setOpacity = useExplorationStore((state) => state.setOpacity);
  const setShowRegression = useExplorationStore((state) => state.setShowRegression);
  const setScatterMode = useExplorationStore((state) => state.setScatterMode);

  const config = {
    type: "scatter" as const,
    x: scatterX,
    y: scatterY,
    size: scatterSize,
    color: "region" as const,
    scale: { x: scaleX, y: scaleY },
    interaction: { brush: scatterMode === "brush", zoom: true, selection: true },
    opacity,
    regression: showRegression,
  };
  const validation = validateVisualizationConfig(config);
  const frameRef = useRef<HTMLDivElement>(null);
  const size = useElementSize(frameRef);

  const prepared = useMemo(() => {
    const rows = yearRows(dataset.index, { year, regions, search });
    const marks: Mark[] = [];
    let missing = 0;
    const xCandidates: number[] = [];
    const yCandidates: number[] = [];
    for (const row of rows) {
      const xValue = row[scatterX];
      const yValue = row[scatterY];
      const country = dataset.index.countryByCode.get(row.countryCode);
      if (!country || xValue == null || yValue == null || (scaleX === "log" && xValue <= 0) || (scaleY === "log" && yValue <= 0)) {
        missing += 1;
        continue;
      }
      xCandidates.push(xValue);
      yCandidates.push(yValue);
      marks.push({
        countryCode: row.countryCode,
        name: country.name,
        region: country.region,
        xValue,
        yValue,
        sizeValue: row[scatterSize],
        outlier: false,
      });
    }
    const xFences = iqrFences(xCandidates);
    const yFences = iqrFences(yCandidates);
    for (const mark of marks) {
      mark.outlier = isOutsideFences(mark.xValue, xFences) || isOutsideFences(mark.yValue, yFences);
    }
    return { marks, missing, rows: rows.length };
  }, [dataset, year, regions, search, scatterX, scatterY, scatterSize, scaleX, scaleY]);

  const [tip, setTip] = useState<Tip | null>(null);
  const selectedCount = selectedIds.length;
  const summary = selectedCount
    ? `${selectedCount} selected`
    : `${prepared.marks.length} ${prepared.marks.length === 1 ? "country" : "countries"} plotted`;

  return (
    <ChartFrame
      title="Multidimensional scatter"
      note={`${summary} in ${year}. ${prepared.missing} omitted for missing or non-positive log values. Outlines mark 1.5 IQR outliers.`}
      testId="scatter-panel"
      focus="scatter"
      toolbar={
        <>
          <MetricSelect label="X" testId="metric-x" value={scatterX} onChange={setScatterX} />
          <MetricSelect label="Y" testId="metric-y" value={scatterY} onChange={setScatterY} />
          <MetricSelect label="Size" testId="metric-size" value={scatterSize} onChange={setScatterSize} />
          <label className="flex items-center gap-1 text-[11px] text-muted">
            X scale
            <select className={selectClass} value={scaleX} onChange={(event) => setScaleX(event.target.value as "linear" | "log")}>
              <option value="linear">Linear</option>
              <option value="log">Log</option>
            </select>
          </label>
          <label className="flex items-center gap-1 text-[11px] text-muted">
            Y scale
            <select className={selectClass} value={scaleY} onChange={(event) => setScaleY(event.target.value as "linear" | "log")}>
              <option value="linear">Linear</option>
              <option value="log">Log</option>
            </select>
          </label>
          <label className="flex items-center gap-1 text-[11px] text-muted">
            Opacity
            <input
              type="range"
              min={0.2}
              max={1}
              step={0.05}
              value={opacity}
              onChange={(event) => setOpacity(Number(event.target.value))}
            />
          </label>
          <label className="flex items-center gap-1 text-[11px] text-muted">
            <input type="checkbox" checked={showRegression} onChange={(event) => setShowRegression(event.target.checked)} />
            OLS fit
          </label>
          <button
            type="button"
            className={selectClass}
            onClick={() => setScatterMode(scatterMode === "brush" ? "pan" : "brush")}
          >
            {scatterMode === "brush" ? "Brush" : "Pan"}
          </button>
        </>
      }
      footer={<RegionLegend regions={dataset.index.regions} />}
    >
      {!validation.ok || !validation.config ? (
        <ConfigError errors={validation.errors} />
      ) : prepared.marks.length === 0 ? (
        <EmptyState
          title="Nothing to plot"
          detail="Every country in this filter is missing a value, or the log scale has no positive observations."
        />
      ) : (
        <div ref={frameRef} className="absolute inset-0" data-testid="scatter-frame">
          <ScatterSurface
            marks={prepared.marks}
            width={size.width}
            height={size.height}
            xMetric={scatterX}
            yMetric={scatterY}
            scaleX={scaleX}
            scaleY={scaleY}
            regression={showRegression}
            mode={scatterMode}
            onTip={setTip}
          />
          {tip ? (
            <ChartTooltip x={tip.left} y={tip.top}>
              <p className="font-medium text-ink">{tip.mark.name}</p>
              <p>{tip.mark.region}</p>
              <p>
                {metricLabel(scatterX)}: {formatMetricValue(scatterX, tip.mark.xValue)}
              </p>
              <p>
                {metricLabel(scatterY)}: {formatMetricValue(scatterY, tip.mark.yValue)}
              </p>
              <p>
                {metricLabel(scatterSize)}: {formatMetricValue(scatterSize, tip.mark.sizeValue)}
              </p>
              {tip.mark.outlier ? <p>Outside the 1.5 IQR fence on X or Y.</p> : null}
            </ChartTooltip>
          ) : null}
        </div>
      )}
    </ChartFrame>
  );
}

function MetricSelect({
  label,
  value,
  testId,
  onChange,
}: {
  label: string;
  value: MetricId;
  testId: string;
  onChange: (metric: MetricId) => void;
}) {
  return (
    <label className="flex items-center gap-1 text-[11px] text-muted">
      {label}
      <select
        data-testid={testId}
        className={selectClass}
        value={value}
        onChange={(event) => onChange(event.target.value as MetricId)}
      >
        {Object.values(METRICS).map((metric) => (
          <option key={metric.id} value={metric.id}>
            {metric.shortName}
          </option>
        ))}
      </select>
    </label>
  );
}

function ScatterSurface({
  marks,
  width,
  height,
  xMetric,
  yMetric,
  scaleX,
  scaleY,
  regression,
  mode,
  onTip,
}: {
  marks: Mark[];
  width: number;
  height: number;
  xMetric: MetricId;
  yMetric: MetricId;
  scaleX: "linear" | "log";
  scaleY: "linear" | "log";
  regression: boolean;
  mode: "brush" | "pan";
  onTip: (tip: Tip | null) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const svgElement = svgRef.current;
    const canvas = canvasRef.current;
    if (!svgElement || !canvas || width < 80 || height < 80) return;
    const margin = { top: 12, right: 16, bottom: 46, left: 58 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    if (innerWidth < 40 || innerHeight < 40) return;

    const xDomain = paddedDomain(finiteValues(marks.map((mark) => mark.xValue), scaleX), scaleX);
    const yDomain = paddedDomain(finiteValues(marks.map((mark) => mark.yValue), scaleY), scaleY);
    if (!xDomain || !yDomain) return;
    const x = (scaleX === "log" ? scaleLog() : scaleLinear()).domain(xDomain).range([0, innerWidth]).nice();
    const y = (scaleY === "log" ? scaleLog() : scaleLinear()).domain(yDomain).range([innerHeight, 0]).nice();
    const sizes = finiteValues(marks.map((mark) => mark.sizeValue));
    const radius = scaleSqrt()
      .domain(sizes.length ? [Math.min(...sizes), Math.max(...sizes)] : [0, 1])
      .range(sizes.length && Math.min(...sizes) !== Math.max(...sizes) ? [4, 24] : [6, 6]);

    const svg = select(svgElement);
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${width} ${height}`);
    const plot = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    const xAxis = plot.append("g").attr("transform", `translate(0,${innerHeight})`);
    const yAxis = plot.append("g");
    const regressionPath = plot.append("path").attr("fill", "none").attr("stroke", "var(--accent)").attr("stroke-dasharray", "4 3");
    const markGroup = plot.append("g");
    const brushGroup = plot.append("g").attr("class", "scatter-brush");
    plot
      .append("text")
      .attr("class", "axis-label")
      .attr("x", innerWidth / 2)
      .attr("y", innerHeight + 36)
      .attr("text-anchor", "middle")
      .text(metricLabel(xMetric));
    plot
      .append("text")
      .attr("class", "axis-label")
      .attr("transform", "rotate(-90)")
      .attr("x", -innerHeight / 2)
      .attr("y", -42)
      .attr("text-anchor", "middle")
      .text(metricLabel(yMetric));

    canvas.style.left = `${margin.left}px`;
    canvas.style.top = `${margin.top}px`;
    const useCanvas = marks.length > CANVAS_THRESHOLD;
    canvas.style.display = useCanvas ? "block" : "none";
    const circles = useCanvas
      ? null
      : markGroup
          .selectAll("circle")
          .data(marks)
          .join("circle")
          .attr("r", (mark) => radius(mark.sizeValue ?? radius.domain()[0] ?? 1))
          .attr("fill", (mark) => regionColor(mark.region))
          .attr("stroke", "var(--canvas)");

    let transform: ZoomTransform = zoomIdentity;
    let index = buildPointIndex<Mark>(marks.map((mark) => ({ x: 0, y: 0, datum: mark })));

    const transformValue = (value: number, kind: "linear" | "log") => (kind === "log" ? Math.log10(value) : value);
    const invertValue = (value: number, kind: "linear" | "log") => (kind === "log" ? 10 ** value : value);
    const fit = linearRegression(
      marks.map((mark) => transformValue(mark.xValue, scaleX)),
      marks.map((mark) => transformValue(mark.yValue, scaleY)),
    );

    const redraw = (next: ZoomTransform) => {
      transform = next;
      const zx = next.rescaleX(x);
      const zy = next.rescaleY(y);
      const xGenerator = axisBottom(zx).tickFormat((value) => formatMetricValue(xMetric, Number(value), "axis"));
      const yGenerator = axisLeft(zy).tickFormat((value) => formatMetricValue(yMetric, Number(value), "axis"));
      const xValues = scaleX === "log" ? decadeTicks(zx.domain()) : null;
      const yValues = scaleY === "log" ? decadeTicks(zy.domain()) : null;
      xAxis.call(xValues ? xGenerator.tickValues(xValues) : xGenerator.ticks(5));
      yAxis.call(yValues ? yGenerator.tickValues(yValues) : yGenerator.ticks(5));
      const selected = new Set(useExplorationStore.getState().selectedIds);
      const hovered = useHoverStore.getState().countryCode;
      const laid = marks.map((mark) => {
        const selectedMark = selected.has(mark.countryCode);
        const pointOpacity = useExplorationStore.getState().opacity;
        const alpha = mark.countryCode === hovered ? 1 : selected.size > 0 && !selectedMark ? pointOpacity * 0.28 : pointOpacity;
        return {
          ...mark,
          cx: zx(mark.xValue),
          cy: zy(mark.yValue),
          r: radius(mark.sizeValue ?? radius.domain()[0] ?? 1),
          alpha,
          selected: selectedMark,
        };
      });
      index = buildPointIndex<Mark>(
        laid.map((mark) => ({
          x: mark.cx,
          y: mark.cy,
          datum: {
            countryCode: mark.countryCode,
            name: mark.name,
            region: mark.region,
            xValue: mark.xValue,
            yValue: mark.yValue,
            sizeValue: mark.sizeValue,
            outlier: mark.outlier,
          },
        })),
      );
      if (circles) {
        circles
          .attr("cx", (_, i) => laid[i]?.cx ?? 0)
          .attr("cy", (_, i) => laid[i]?.cy ?? 0)
          .attr("fill-opacity", (_, i) => laid[i]?.alpha ?? useExplorationStore.getState().opacity)
          .attr("stroke", (_, i) => (laid[i]?.selected || laid[i]?.outlier ? "var(--select)" : "var(--canvas)"))
          .attr("stroke-width", (_, i) => (laid[i]?.selected ? 1.6 : laid[i]?.outlier ? 1 : 0.4));
      } else {
        const context = canvas.getContext("2d");
        if (context) {
          const ratio = window.devicePixelRatio || 1;
          canvas.width = Math.floor(innerWidth * ratio);
          canvas.height = Math.floor(innerHeight * ratio);
          canvas.style.width = `${innerWidth}px`;
          canvas.style.height = `${innerHeight}px`;
          context.setTransform(ratio, 0, 0, ratio, 0, 0);
          context.clearRect(0, 0, innerWidth, innerHeight);
          for (const mark of laid) {
            context.beginPath();
            context.arc(mark.cx, mark.cy, mark.r, 0, Math.PI * 2);
            context.globalAlpha = mark.alpha;
            context.fillStyle = regionColor(mark.region);
            context.fill();
            if (mark.selected || mark.outlier) {
              context.globalAlpha = 1;
              context.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--select").trim() || "#1c2b42";
              context.lineWidth = mark.selected ? 1.6 : 1;
              context.stroke();
            }
          }
          context.globalAlpha = 1;
        }
      }
      if (regression && fit) {
        const [x0, x1] = zx.domain() as [number, number];
        const y0 = invertValue(fit.intercept + fit.slope * transformValue(x0, scaleX), scaleY);
        const y1 = invertValue(fit.intercept + fit.slope * transformValue(x1, scaleX), scaleY);
        if ((scaleY !== "log" || (y0 > 0 && y1 > 0)) && Number.isFinite(y0) && Number.isFinite(y1)) {
          regressionPath.attr("d", `M${zx(x0)},${zy(y0)}L${zx(x1)},${zy(y1)}`);
        } else regressionPath.attr("d", null);
      } else regressionPath.attr("d", null);
    };

    let brushBehavior: BrushBehavior<unknown> | null = null;
    let silent = false;
    if (mode === "brush") {
      brushBehavior = brush<unknown>()
        .extent([
          [0, 0],
          [innerWidth, innerHeight],
        ])
        .on("end", (event) => {
          if (silent || !event.selection) return;
          const [[x0, y0], [x1, y1]] = event.selection as [[number, number], [number, number]];
          silent = true;
          brushGroup.call(brushBehavior!.move, null);
          silent = false;
          if (Math.abs(x1 - x0) < 4 && Math.abs(y1 - y0) < 4) {
            const found = findNearest(index, (x0 + x1) / 2, (y0 + y1) / 2, 16);
            if (found) useExplorationStore.getState().toggleCountry(found.countryCode);
            return;
          }
          const hits: string[] = [];
          index.visit((node, left, top, right, bottom) => {
            if (right < x0 || left > x1 || bottom < y0 || top > y1) return true;
            if (!node.length) {
              let leaf: typeof node | undefined = node;
              while (leaf) {
                if (leaf.data.x >= x0 && leaf.data.x <= x1 && leaf.data.y >= y0 && leaf.data.y <= y1) {
                  hits.push(leaf.data.datum.countryCode);
                }
                leaf = leaf.next;
              }
            }
            return false;
          });
          useExplorationStore.getState().setSelected(hits);
        });
      brushGroup.call(brushBehavior);
    }

    const zoomBehavior: ZoomBehavior<SVGSVGElement, unknown> = zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 12])
      .extent([
        [0, 0],
        [innerWidth, innerHeight],
      ])
      .filter((event: Event) => {
        if (event.type === "wheel") return true;
        if (mode === "brush") return false;
        return event instanceof MouseEvent ? event.button === 0 : true;
      })
      .on("zoom", (event) => redraw(event.transform));
    svg.call(zoomBehavior);
    redraw(zoomIdentity);

    const restyle = () => redraw(transform);
    const unsubscribe = useExplorationStore.subscribe(restyle);
    const unsubscribeHover = useHoverStore.subscribe(restyle);
    svg.on("pointermove", (event) => {
      const [px, py] = pointer(event, plot.node() ?? svgElement);
      const found = findNearest(index, px, py, 16);
      useHoverStore.getState().setHovered(found?.countryCode ?? null);
      if (!found) {
        onTip(null);
        return;
      }
      const rect = svgElement.getBoundingClientRect();
      onTip({
        mark: found,
        left: Math.min(event.clientX - rect.left + 14, width - 180),
        top: Math.min(event.clientY - rect.top + 14, height - 90),
      });
    });
    svg.on("pointerleave", () => {
      useHoverStore.getState().setHovered(null);
      onTip(null);
    });
    svg.on("click", (event) => {
      if (mode !== "pan") return;
      const [px, py] = pointer(event, plot.node() ?? svgElement);
      const found = findNearest(index, px, py, 16);
      if (found) useExplorationStore.getState().toggleCountry(found.countryCode);
      else useExplorationStore.getState().clearSelection();
    });

    return () => {
      unsubscribe();
      unsubscribeHover();
      svg.on(".zoom", null);
      svg.on("pointermove", null);
      svg.on("pointerleave", null);
      svg.on("click", null);
      brushBehavior?.on("end", null);
      svg.selectAll("*").remove();
    };
  }, [marks, width, height, xMetric, yMetric, scaleX, scaleY, regression, mode, onTip]);

  return (
    <>
      <canvas ref={canvasRef} className="pointer-events-none absolute" data-testid="scatter-canvas" />
      <svg
        ref={svgRef}
        data-testid="scatter-svg"
        className="chart-svg absolute inset-0 h-full w-full"
        role="img"
        aria-label={`Scatter plot of ${metricLabel(yMetric)} against ${metricLabel(xMetric)} for ${marks.length} ${marks.length === 1 ? "country" : "countries"}.`}
      />
    </>
  );
}
