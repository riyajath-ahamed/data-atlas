import { median } from "d3-array";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { useDataset } from "../../app/dataset.tsx";
import { METRICS } from "../../data/schemas/types.ts";
import { DataTable } from "../../features/data-explorer/DataTable.tsx";
import { Choropleth } from "../../features/geographic-explorer/Choropleth.tsx";
import { HierarchyExplorer } from "../../features/hierarchical-explorer/Treemap.tsx";
import { CorrelationMatrix } from "../../features/correlation-analysis/CorrelationMatrix.tsx";
import { AdjacencyNetwork } from "../../features/relationship-explorer/AdjacencyNetwork.tsx";
import { ScatterPlot } from "../../features/scatter-explorer/ScatterPlot.tsx";
import { Timeline } from "../../features/temporal-explorer/Timeline.tsx";
import { yearRows } from "../../state/selectors.ts";
import { useExplorationStore } from "../../state/exploration-store.ts";
import { useHoverStore } from "../../state/hover-store.ts";
import { formatMetricValue } from "../../utils/format.ts";
import { Sidebar } from "./Sidebar.tsx";
import { TopBar } from "./TopBar.tsx";

export function AppShell() {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") useHoverStore.getState().setHovered(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div data-testid="app-shell" className="relative flex h-svh w-full min-w-0 flex-col overflow-x-hidden bg-transparent text-ink">
      <a className="skip-link" href="#workspace">
        Skip to charts
      </a>
      <TopBar />
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <Sidebar />
        <main id="workspace" className="min-h-0 min-w-0 flex-1 overflow-auto p-3 md:p-4">
          <Workspace />
        </main>
      </div>
    </div>
  );
}

function Workspace() {
  const view = useExplorationStore((state) => state.activeView);
  const focused = useExplorationStore((state) => state.focusedView);
  if (focused) return <div className="h-[calc(100svh-11.5rem)] min-h-[520px]">{chartFor(focused)}</div>;
  if (view === "overview") {
    return (
      <div className="grid gap-3 lg:grid-cols-5">
        <div className="h-[520px] lg:col-span-3"><ScatterPlot /></div>
        <div className="h-[520px] lg:col-span-2"><Choropleth /></div>
        <div className="h-[320px] lg:col-span-3"><Timeline /></div>
        <div className="h-[320px] lg:col-span-2"><OverviewNotes /></div>
      </div>
    );
  }
  if (view === "geographic") {
    return (
      <div className="grid gap-3 lg:grid-cols-5">
        <div className="h-[640px] lg:col-span-3"><Choropleth /></div>
        <div className="grid gap-3 lg:col-span-2">
          <div className="h-[320px]"><ScatterPlot /></div>
          <div className="h-[300px]"><Timeline /></div>
        </div>
      </div>
    );
  }
  if (view === "scatter") {
    return (
      <div className="grid gap-3">
        <div className="h-[640px]"><ScatterPlot /></div>
        <div className="h-[280px]"><Timeline /></div>
      </div>
    );
  }
  if (view === "timeline") {
    return (
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="h-[560px] lg:col-span-2"><Timeline /></div>
        <div className="h-[320px]"><Choropleth /></div>
        <div className="h-[320px]"><ScatterPlot /></div>
      </div>
    );
  }
  if (view === "correlation") return <div className="h-[calc(100svh-11.5rem)] min-h-[560px]"><CorrelationMatrix /></div>;
  if (view === "relationship") return <div className="h-[calc(100svh-11.5rem)] min-h-[560px]"><AdjacencyNetwork /></div>;
  if (view === "hierarchy") return <div className="h-[calc(100svh-11.5rem)] min-h-[560px]"><HierarchyExplorer /></div>;
  return <div className="h-[calc(100svh-11.5rem)] min-h-[560px]"><DataTable /></div>;
}

function chartFor(focus: NonNullable<ReturnType<typeof useExplorationStore.getState>["focusedView"]>): ReactNode {
  if (focus === "scatter") return <ScatterPlot />;
  if (focus === "map") return <Choropleth />;
  if (focus === "timeline") return <Timeline />;
  if (focus === "correlation") return <CorrelationMatrix />;
  if (focus === "network") return <AdjacencyNetwork />;
  if (focus === "treemap") return <HierarchyExplorer />;
  return <DataTable />;
}

function OverviewNotes() {
  const dataset = useDataset();
  const year = useExplorationStore((state) => state.year);
  const regions = useExplorationStore((state) => state.regions);
  const search = useExplorationStore((state) => state.search);
  const selectedIds = useExplorationStore((state) => state.selectedIds);
  const mapMetric = useExplorationStore((state) => state.mapMetric);
  const rows = yearRows(dataset.index, { year, regions, search });
  const focusRows = selectedIds.length ? rows.filter((row) => selectedIds.includes(row.countryCode)) : rows;
  const values = focusRows.map((row) => row[mapMetric]).filter((value): value is number => value != null);
  const mid = median(values) ?? null;
  const missing = focusRows.length - values.length;
  return (
    <section className="panel flex h-full flex-col overflow-hidden px-4 pt-4 pb-5">
      <h2 className="font-display text-[18px] leading-[1.33] font-bold tracking-tight text-muted">Reading {year}</h2>
      <p className="mt-3 font-mono text-[1.85rem] leading-none tracking-tight text-ink">
        {mid == null ? "No data" : formatMetricValue(mapMetric, mid)}
      </p>
      <p className="mt-2 text-[12px] text-faint">
        Median {METRICS[mapMetric].shortName.toLowerCase()} · {focusRows.length}{" "}
        {focusRows.length === 1 ? "country" : "countries"}
        {missing > 0 ? ` · ${missing} unpublished` : ""}
      </p>
      <p className="mt-4 max-w-[38rem] text-pretty text-[13px] leading-relaxed text-muted">
        Choose a country on the map, in the scatter plot, or in the table. The same selection is kept while you move between views.
        Brush the timeline to narrow the years used by the other charts. The fit line on the scatter plot is ordinary least squares in
        the displayed scale. It is a visual summary, not a model of cause.
      </p>
      {selectedIds.length > 0 ? (
        <ul className="mt-auto space-y-0 pt-4 text-[12px]">
          {selectedIds.slice(0, 6).map((code) => {
            const country = dataset.index.countryByCode.get(code);
            const row = rows.find((item) => item.countryCode === code);
            return (
              <li key={code} className="flex justify-between gap-3 border-t border-line py-1.5">
                <span>{country?.name ?? code}</span>
                <span className="font-mono text-muted">{formatMetricValue(mapMetric, row?.[mapMetric] ?? null)}</span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
