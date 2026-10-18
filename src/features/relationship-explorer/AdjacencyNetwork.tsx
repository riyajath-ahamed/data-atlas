import { drag } from "d3-drag";
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, type SimulationLinkDatum, type SimulationNodeDatum } from "d3-force";
import { select } from "d3-selection";
import { zoom } from "d3-zoom";
import { useEffect, useMemo, useRef, useState } from "react";
import { scaleSqrt } from "d3-scale";
import { useDataset } from "../../app/dataset.tsx";
import { validateVisualizationConfig } from "../../engine/visualization-registry/validateConfig.ts";
import { countryPasses } from "../../engine/transforms/filter.ts";
import { useElementSize } from "../../hooks/useElementSize.ts";
import { yearRows } from "../../state/selectors.ts";
import { useExplorationStore } from "../../state/exploration-store.ts";
import { useHoverStore } from "../../state/hover-store.ts";
import { regionColor } from "../../utils/format.ts";
import { ChartFrame, EmptyState } from "../../components/layout/ChartFrame.tsx";

interface Node extends SimulationNodeDatum {
  id: string;
  name: string;
  region: string;
  population: number | null;
}

export function AdjacencyNetwork() {
  const dataset = useDataset();
  const year = useExplorationStore((state) => state.year);
  const regions = useExplorationStore((state) => state.regions);
  const search = useExplorationStore((state) => state.search);
  const selectedIds = useExplorationStore((state) => state.selectedIds);
  const activeView = useExplorationStore((state) => state.activeView);
  const focusedView = useExplorationStore((state) => state.focusedView);
  const [focusNeighbors, setFocusNeighbors] = useState(false);
  const [paused, setPaused] = useState(false);
  const validation = validateVisualizationConfig({ type: "network", relationship: "adjacency", size: "population" });
  const frameRef = useRef<HTMLDivElement>(null);
  const size = useElementSize(frameRef);
  const visible = activeView === "relationship" || focusedView === "network";

  const graph = useMemo(() => {
    const population = new Map(yearRows(dataset.index, { year, regions: [], search: "" }).map((row) => [row.countryCode, row.population]));
    const allowed = new Set(
      dataset.index.countries
        .filter((country) => countryPasses(dataset.index, country.countryCode, { regions, search }))
        .map((country) => country.countryCode),
    );
    let ids = allowed;
    if (focusNeighbors && selectedIds.length) {
      const extra = new Set(selectedIds);
      for (const link of dataset.links) {
        if (selectedIds.includes(link.source)) extra.add(link.target);
        if (selectedIds.includes(link.target)) extra.add(link.source);
      }
      ids = extra;
    }
    const nodes: Node[] = [...ids]
      .map((id) => {
        const country = dataset.index.countryByCode.get(id);
        if (!country) return null;
        return { id, name: country.name, region: country.region, population: population.get(id) ?? null };
      })
      .filter((node): node is Node => node != null);
    const nodeIds = new Set(nodes.map((node) => node.id));
    const links = dataset.links
      .filter((link) => nodeIds.has(link.source) && nodeIds.has(link.target))
      .map((link) => ({ source: link.source, target: link.target }));
    return { nodes, links };
  }, [dataset, year, regions, search, focusNeighbors, selectedIds]);

  return (
    <ChartFrame
      title="Relationship explorer"
      note="Links are shared land borders from Natural Earth 110m, not trade or alliances. Node area is population in the selected year."
      testId="network-panel"
      focus="network"
      toolbar={
        <>
          <button type="button" className="field text-[11px]" onClick={() => setFocusNeighbors((value) => !value)}>
            {focusNeighbors ? "Showing neighbors" : "Focus neighbors"}
          </button>
          <button type="button" className="field text-[11px]" onClick={() => setPaused((value) => !value)}>
            {paused ? "Resume" : "Pause"}
          </button>
        </>
      }
    >
      {!validation.ok ? (
        <EmptyState title="Network configuration is invalid" detail={validation.errors.join(" ")} />
      ) : graph.nodes.length === 0 ? (
        <EmptyState title="No countries to link" detail="The current search or region filter excludes every country with a boundary." />
      ) : (
        <div ref={frameRef} className="absolute inset-0">
          {visible ? (
            <NetworkSvg
              nodes={graph.nodes}
              links={graph.links}
              width={size.width}
              height={size.height}
              paused={paused}
              selectedIds={selectedIds}
            />
          ) : null}
        </div>
      )}
    </ChartFrame>
  );
}

function NetworkSvg({
  nodes,
  links,
  width,
  height,
  paused,
  selectedIds,
}: {
  nodes: Node[];
  links: { source: string; target: string }[];
  width: number;
  height: number;
  paused: boolean;
  selectedIds: string[];
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const pausedRef = useRef(paused);
  const selectedRef = useRef(selectedIds);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  useEffect(() => {
    selectedRef.current = selectedIds;
  }, [selectedIds]);

  useEffect(() => {
    const svgElement = svgRef.current;
    if (!svgElement || width < 80 || height < 80) return;
    const svg = select(svgElement);
    svg.selectAll("*").remove();
    const populations = nodes.map((node) => node.population).filter((value): value is number => value != null && value > 0);
    const radius = scaleSqrt()
      .domain([Math.min(...populations, 1), Math.max(...populations, 1)])
      .range([4, 18]);
    const simNodes: Node[] = nodes.map((node) => ({ ...node }));
    const simLinks: SimulationLinkDatum<Node>[] = links.map((link) => ({ source: link.source, target: link.target }));
    const drawing = svg.append("g");
    const linkSel = drawing
      .append("g")
      .selectAll("line")
      .data(simLinks)
      .join("line")
      .attr("stroke", "var(--line)")
      .attr("stroke-width", 1);
    const nodeSel = drawing
      .append("g")
      .selectAll("circle")
      .data(simNodes)
      .join("circle")
      .attr("r", (node) => radius(node.population && node.population > 0 ? node.population : 1))
      .attr("fill", (node) => regionColor(node.region))
      .attr("stroke", "var(--canvas)")
      .on("pointerenter", (_event, node) => useHoverStore.getState().setHovered(node.id))
      .on("pointerleave", () => useHoverStore.getState().setHovered(null))
      .on("click", (event, node) => {
        event.stopPropagation();
        useExplorationStore.getState().toggleCountry(node.id);
      });
    const labelSel = drawing
      .append("g")
      .selectAll("text")
      .data(simNodes)
      .join("text")
      .attr("class", "axis-label")
      .attr("dx", 8)
      .attr("dy", 3)
      .text((node) => node.name);

    const simulation = forceSimulation(simNodes)
      .force("link", forceLink<Node, SimulationLinkDatum<Node>>(simLinks).id((node) => node.id).distance(42))
      .force("charge", forceManyBody().strength(-28))
      .force("center", forceCenter(width / 2, height / 2))
      .force("collide", forceCollide<Node>().radius((node) => radius(node.population && node.population > 0 ? node.population : 1) + 2))
      .on("tick", () => {
        linkSel
          .attr("x1", (link) => (link.source as unknown as Node).x ?? 0)
          .attr("y1", (link) => (link.source as unknown as Node).y ?? 0)
          .attr("x2", (link) => (link.target as unknown as Node).x ?? 0)
          .attr("y2", (link) => (link.target as unknown as Node).y ?? 0);
        nodeSel.attr("cx", (node) => node.x ?? 0).attr("cy", (node) => node.y ?? 0);
        labelSel.attr("x", (node) => node.x ?? 0).attr("y", (node) => node.y ?? 0);
        paint();
      });
    nodeSel.call(
      drag<SVGCircleElement, Node>()
        .on("start", (event, node) => {
          if (!event.active) simulation.alphaTarget(0.2).restart();
          node.fx = node.x;
          node.fy = node.y;
        })
        .on("drag", (event, node) => {
          node.fx = event.x;
          node.fy = event.y;
        })
        .on("end", (event, node) => {
          if (!event.active) simulation.alphaTarget(0);
          node.fx = null;
          node.fy = null;
        }) as never,
    );

    const paint = () => {
      const selected = new Set(selectedRef.current);
      const hovered = useHoverStore.getState().countryCode;
      const neighbors = new Set<string>();
      if (hovered) {
        neighbors.add(hovered);
        for (const link of simLinks) {
          const source = (link.source as unknown as Node).id ?? (link.source as unknown as string);
          const target = (link.target as unknown as Node).id ?? (link.target as unknown as string);
          if (source === hovered) neighbors.add(String(target));
          if (target === hovered) neighbors.add(String(source));
        }
      }
      nodeSel.attr("opacity", (node) => {
        if (selected.size === 0 && !hovered) return 0.9;
        if (selected.has(node.id) || neighbors.has(node.id)) return 1;
        return 0.25;
      });
      nodeSel.attr("stroke", (node) => (selected.has(node.id) ? "var(--select)" : "var(--canvas)"));
      const scale = Number(drawing.attr("data-k") ?? 1);
      labelSel.attr("display", (node) => (scale > 1.35 || selected.has(node.id) || node.id === hovered ? "block" : "none"));
    };

    const zoomBehavior = zoom<SVGSVGElement, unknown>().scaleExtent([0.4, 6]).on("zoom", (event) => {
      drawing.attr("transform", event.transform.toString());
      drawing.attr("data-k", String(event.transform.k));
      paint();
    });
    svg.call(zoomBehavior);
    if (pausedRef.current) simulation.stop();
    const unsubscribe = useExplorationStore.subscribe(paint);
    const unsubscribeHover = useHoverStore.subscribe(paint);
    const interval = window.setInterval(() => {
      if (pausedRef.current) simulation.stop();
      else if (simulation.alpha() > 0) simulation.restart();
    }, 200);

    return () => {
      window.clearInterval(interval);
      unsubscribe();
      unsubscribeHover();
      simulation.on("tick", null);
      simulation.stop();
      svg.on(".zoom", null);
      svg.selectAll("*").remove();
    };
  }, [nodes, links, width, height]);

  return (
    <svg
      ref={svgRef}
      data-testid="network-svg"
      className="chart-svg absolute inset-0 h-full w-full"
      role="img"
      aria-label="Force-directed map of countries that share a land border."
    />
  );
}
