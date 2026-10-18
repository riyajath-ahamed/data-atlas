import { interpolateRdBu } from "d3-scale-chromatic";
import { useMemo, useState } from "react";
import { METRICS, METRIC_IDS, type MetricId } from "../../data/schemas/types.ts";
import { clusterOrder, correlationMatrix, type MatrixCell } from "../../engine/statistics/correlation.ts";
import { validateVisualizationConfig } from "../../engine/visualization-registry/validateConfig.ts";
import { useDataset } from "../../app/dataset.tsx";
import { yearRows } from "../../state/selectors.ts";
import { useExplorationStore } from "../../state/exploration-store.ts";
import { ChartFrame, ConfigError } from "../../components/layout/ChartFrame.tsx";

export function CorrelationMatrix() {
  const dataset = useDataset();
  const year = useExplorationStore((state) => state.year);
  const regions = useExplorationStore((state) => state.regions);
  const search = useExplorationStore((state) => state.search);
  const metrics = useExplorationStore((state) => state.correlationMetrics);
  const sort = useExplorationStore((state) => state.correlationSort);
  const toggle = useExplorationStore((state) => state.toggleCorrelationMetric);
  const setSort = useExplorationStore((state) => state.setCorrelationSort);
  const validation = validateVisualizationConfig({ type: "correlation", metrics, sort });
  const rows = useMemo(() => yearRows(dataset.index, { year, regions, search }), [dataset, year, regions, search]);
  const records = useMemo(
    () => rows.map((row) => Object.fromEntries(METRIC_IDS.map((metric) => [metric, row[metric]])) as Record<string, number | null>),
    [rows],
  );
  const cells = useMemo(() => correlationMatrix(records, metrics), [records, metrics]);
  const order = useMemo(
    () => (sort === "similarity" ? clusterOrder(metrics, cells) : [...metrics].sort((a, b) => METRICS[a].shortName.localeCompare(METRICS[b].shortName))),
    [sort, metrics, cells],
  );
  const lookup = useMemo(() => new Map(cells.map((cell) => [`${cell.left}|${cell.right}`, cell])), [cells]);
  const [active, setActive] = useState<MatrixCell | null>(null);

  return (
    <ChartFrame
      title="Correlation analysis"
      note="Pearson r on pairwise-complete countries for the selected year. Association is not causation."
      testId="correlation-panel"
      focus="correlation"
      toolbar={
        <>
          {METRIC_IDS.map((metric) => (
            <label key={metric} className="flex items-center gap-1 text-[11px] text-muted">
              <input type="checkbox" checked={metrics.includes(metric)} onChange={() => toggle(metric)} />
              {METRICS[metric].shortName}
            </label>
          ))}
          <button type="button" className="field text-[11px]" onClick={() => setSort(sort === "name" ? "similarity" : "name")}>
            Sort: {sort === "name" ? "Name" : "Similarity"}
          </button>
        </>
      }
      footer={
        active?.result ? (
          <p>
            {METRICS[active.left as MetricId].shortName} and {METRICS[active.right as MetricId].shortName}: r = {active.result.r.toFixed(2)}, n = {active.result.n}
            {active.result.p != null ? `, two-sided t test p = ${active.result.p < 0.001 ? "< 0.001" : active.result.p.toFixed(3)} (df ${active.result.df})` : ""}.
            The test is H0: r = 0 under independent bivariate normality. It does not measure a cause.
          </p>
        ) : (
          <p>Hover a cell for the coefficient, pair count, and the two-sided t test. At least two indicators stay selected.</p>
        )
      }
    >
      {!validation.ok ? (
        <ConfigError errors={validation.errors} />
      ) : (
        <div className="absolute inset-0 overflow-auto p-3" data-testid="correlation-matrix">
          <table className="border-collapse text-[11px]">
            <thead>
              <tr>
                <th />
                {order.map((metric) => (
                  <th key={metric} className="max-w-16 px-1 pb-1 text-center font-normal text-muted">
                    {METRICS[metric].shortName}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {order.map((rowMetric) => (
                <tr key={rowMetric}>
                  <th className="pr-2 text-left font-normal text-muted">{METRICS[rowMetric].shortName}</th>
                  {order.map((columnMetric) => {
                    const cell = lookup.get(`${rowMetric}|${columnMetric}`);
                    const r = cell?.result?.r;
                    return (
                      <td key={columnMetric} className="p-0.5">
                        <button
                          type="button"
                          className="flex h-12 w-12 items-center justify-center font-mono text-[10px] text-canvas"
                          style={{ background: r == null ? "var(--missing)" : interpolateRdBu((r + 1) / 2) }}
                          onMouseEnter={() => cell && setActive(cell)}
                          onFocus={() => cell && setActive(cell)}
                        >
                          {r == null ? "—" : r.toFixed(2)}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ChartFrame>
  );
}
