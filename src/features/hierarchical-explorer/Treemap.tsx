import { hierarchy, treemap, treemapResquarify, type HierarchyNode } from "d3-hierarchy";
import { select } from "d3-selection";
import { useEffect, useMemo, useRef, useState } from "react";
import { METRICS, type MetricId } from "../../data/schemas/types.ts";
import { validateVisualizationConfig } from "../../engine/visualization-registry/validateConfig.ts";
import { useElementSize } from "../../hooks/useElementSize.ts";
import { useDataset } from "../../app/dataset.tsx";
import { yearRows } from "../../state/selectors.ts";
import { useExplorationStore } from "../../state/exploration-store.ts";
import { formatMetricValue, regionColor } from "../../utils/format.ts";
import { ChartFrame, ConfigError, EmptyState } from "../../components/layout/ChartFrame.tsx";
import { ChartTooltip } from "../../components/tooltips/ChartTooltip.tsx";

interface Leaf {
  name: string;
  id: string;
  region: string;
  value: number;
}

interface Branch {
  name: string;
  children: Leaf[];
}

export function HierarchyExplorer() {
  const dataset = useDataset();
  const metric = useExplorationStore((state) => state.hierarchyMetric);
  const year = useExplorationStore((state) => state.year);
  const regions = useExplorationStore((state) => state.regions);
  const search = useExplorationStore((state) => state.search);
  const setMetric = useExplorationStore((state) => state.setHierarchyMetric);
  const [path, setPath] = useState<string | null>(null);
  const validation = validateVisualizationConfig({ type: "treemap", size: metric, color: "region" });
  const frameRef = useRef<HTMLDivElement>(null);
  const size = useElementSize(frameRef);
  const [tip, setTip] = useState<{ left: number; top: number; name: string; value: number; region: string } | null>(null);

  const tree = useMemo(() => {
    const rows = yearRows(dataset.index, { year, regions, search });
    const byRegion = new Map<string, Leaf[]>();
    let skipped = 0;
    for (const row of rows) {
      const country = dataset.index.countryByCode.get(row.countryCode);
      const value = row[metric];
      if (!country || value == null || value <= 0) {
        skipped += 1;
        continue;
      }
      const leaves = byRegion.get(country.region) ?? [];
      leaves.push({ name: country.name, id: row.countryCode, region: country.region, value });
      byRegion.set(country.region, leaves);
    }
    const children: Branch[] = [...byRegion.entries()].map(([name, leaves]) => ({ name, children: leaves }));
    return { children, skipped };
  }, [dataset, year, regions, search, metric]);

  const visible = path ? tree.children.filter((branch) => branch.name === path) : tree.children;

  return (
    <ChartFrame
      title="Hierarchical explorer"
      note="Rectangle area is the selected measure. Zero and missing values are excluded, not drawn as empty slivers."
      testId="treemap-panel"
      focus="treemap"
      toolbar={
        <label className="flex items-center gap-1 text-[11px] text-muted">
          Size
          <select className="field text-[11px]" value={metric} onChange={(event) => setMetric(event.target.value as MetricId)}>
            {Object.values(METRICS).map((item) => (
              <option key={item.id} value={item.id}>{item.shortName}</option>
            ))}
          </select>
        </label>
      }
      footer={
        <nav aria-label="Hierarchy" className="flex flex-wrap items-center gap-2">
          <button type="button" className="text-ink" onClick={() => setPath(null)}>
            World
          </button>
          {path ? <span>/ {path}</span> : null}
          <span className="text-faint">{tree.skipped} countries omitted</span>
        </nav>
      }
    >
      {!validation.ok ? (
        <ConfigError errors={validation.errors} />
      ) : visible.length === 0 ? (
        <EmptyState title="No hierarchy to draw" detail="None of the filtered countries have a positive value for this measure." />
      ) : (
        <div ref={frameRef} className="absolute inset-0">
          <TreemapSvg
            branches={visible}
            drilled={path != null}
            width={size.width}
            height={size.height}
            onDrill={setPath}
            onTip={setTip}
          />
          {tip ? (
            <ChartTooltip x={tip.left} y={tip.top}>
              <p className="font-medium text-ink">{tip.name}</p>
              <p>{tip.region}</p>
              <p>{formatMetricValue(metric, tip.value)}</p>
            </ChartTooltip>
          ) : null}
        </div>
      )}
    </ChartFrame>
  );
}

function TreemapSvg({
  branches,
  drilled,
  width,
  height,
  onDrill,
  onTip,
}: {
  branches: Branch[];
  drilled: boolean;
  width: number;
  height: number;
  onDrill: (region: string | null) => void;
  onTip: (tip: { left: number; top: number; name: string; value: number; region: string } | null) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const svgElement = svgRef.current;
    if (!svgElement || width < 40 || height < 40) return;
    const root = hierarchy({ name: "World", children: branches }).sum((node) =>
      "value" in node && typeof node.value === "number" ? node.value : 0,
    );
    const laidOut = treemap<{ name: string }>()
      .size([width, height])
      .paddingInner(2)
      .paddingOuter(2)
      .tile(treemapResquarify)(root as unknown as HierarchyNode<{ name: string }>);
    const svg = select(svgElement);
    svg.selectAll("*").remove();
    const leaves = laidOut.leaves();
    svg
      .selectAll("g")
      .data(leaves)
      .join("g")
      .attr("transform", (node) => `translate(${node.x0},${node.y0})`)
      .each(function each(node) {
        const data = node.data as Leaf;
        const widthPx = node.x1 - node.x0;
        const heightPx = node.y1 - node.y0;
        const group = select(this);
        group
          .append("rect")
          .attr("width", widthPx)
          .attr("height", heightPx)
          .attr("fill", regionColor(data.region))
          .attr("opacity", 0.85)
          .on("pointerenter", (event) => {
            const rect = svgElement.getBoundingClientRect();
            onTip({
              name: data.name,
              region: data.region,
              value: data.value,
              left: Math.min(event.clientX - rect.left + 12, width - 160),
              top: Math.min(event.clientY - rect.top + 12, height - 64),
            });
          })
          .on("pointerleave", () => onTip(null))
          .on("click", () => {
            if (drilled) useExplorationStore.getState().toggleCountry(data.id);
            else onDrill(data.region);
          });
        if (widthPx > 56 && heightPx > 22) {
          group
            .append("text")
            .attr("x", 4)
            .attr("y", 14)
            .attr("class", "axis-label")
            .attr("fill", "var(--canvas)")
            .text(data.name);
        }
      });
    return () => {
      svg.selectAll("*").remove();
    };
  }, [branches, drilled, width, height, onDrill, onTip]);

  return <svg ref={svgRef} data-testid="treemap-svg" className="chart-svg absolute inset-0 h-full w-full" role="img" aria-label="Treemap of countries grouped by World Bank region." />;
}
