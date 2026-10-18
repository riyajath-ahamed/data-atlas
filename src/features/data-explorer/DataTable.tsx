import { useMemo, useState } from "react";
import { METRICS, METRIC_IDS, type MetricId } from "../../data/schemas/types.ts";
import { useDataset } from "../../app/dataset.tsx";
import { yearRows } from "../../state/selectors.ts";
import { useExplorationStore } from "../../state/exploration-store.ts";
import { formatMetricValue } from "../../utils/format.ts";
import { ChartFrame } from "../../components/layout/ChartFrame.tsx";

type SortKey = "name" | "region" | MetricId;

export function DataTable() {
  const dataset = useDataset();
  const year = useExplorationStore((state) => state.year);
  const regions = useExplorationStore((state) => state.regions);
  const search = useExplorationStore((state) => state.search);
  const selectedIds = useExplorationStore((state) => state.selectedIds);
  const toggleCountry = useExplorationStore((state) => state.toggleCountry);
  const [columns, setColumns] = useState<MetricId[]>([...METRIC_IDS]);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [direction, setDirection] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const rows = useMemo(() => {
    const observations = yearRows(dataset.index, { year, regions, search });
    const decorated = observations.map((row) => {
      const country = dataset.index.countryByCode.get(row.countryCode);
      return { ...row, name: country?.name ?? row.countryCode, region: country?.region ?? "" };
    });
    decorated.sort((left, right) => {
      const a = sortKey === "name" || sortKey === "region" ? left[sortKey] : left[sortKey];
      const b = sortKey === "name" || sortKey === "region" ? right[sortKey] : right[sortKey];
      if (typeof a === "number" || typeof b === "number" || a == null || b == null) {
        const an = typeof a === "number" ? a : null;
        const bn = typeof b === "number" ? b : null;
        if (an == null && bn == null) return 0;
        if (an == null) return 1;
        if (bn == null) return -1;
        return direction === "asc" ? an - bn : bn - an;
      }
      return direction === "asc" ? String(a).localeCompare(String(b)) : String(b).localeCompare(String(a));
    });
    return decorated;
  }, [dataset, year, regions, search, sortKey, direction]);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const visible = rows.slice(safePage * pageSize, safePage * pageSize + pageSize);

  const sortBy = (key: SortKey) => {
    if (sortKey === key) setDirection((current) => (current === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setDirection(key === "name" || key === "region" ? "asc" : "desc");
    }
    setPage(0);
  };

  return (
    <ChartFrame
      title="Data explorer"
      note={`${rows.length} ${rows.length === 1 ? "country" : "countries"} in ${year}. Selecting a row highlights that country on the map, scatter plot, and timeline.`}
      testId="data-table"
      focus="table"
      toolbar={
        <fieldset className="flex flex-wrap gap-2 border-0 p-0 text-[11px] text-muted">
          <legend className="sr-only">Visible metric columns</legend>
          {METRIC_IDS.map((metric) => (
            <label key={metric} className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={columns.includes(metric)}
                onChange={() =>
                  setColumns((current) =>
                    current.includes(metric) ? current.filter((item) => item !== metric) : [...current, metric],
                  )
                }
              />
              {METRICS[metric].shortName}
            </label>
          ))}
        </fieldset>
      }
      footer={
        <div className="flex items-center justify-between gap-3">
          <span>
            Page {safePage + 1} of {pageCount}
          </span>
          <span className="flex gap-2">
            <button type="button" className="field text-[11px]" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
              Previous
            </button>
            <button
              type="button"
              className="field text-[11px]"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage(safePage + 1)}
            >
              Next
            </button>
          </span>
        </div>
      }
    >
      <div className="absolute inset-0 overflow-auto">
        <table className="w-full border-collapse text-left text-[12px]">
          <thead className="sticky top-0 bg-surface-2 text-[11px] text-muted">
            <tr>
              <SortHeader label="Country" active={sortKey === "name"} onClick={() => sortBy("name")} />
              <SortHeader label="Region" active={sortKey === "region"} onClick={() => sortBy("region")} />
              {columns.map((metric) => (
                <SortHeader key={metric} label={METRICS[metric].shortName} active={sortKey === metric} onClick={() => sortBy(metric)} />
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const selected = selectedIds.includes(row.countryCode);
              return (
                <tr
                  key={row.countryCode}
                  data-testid={`country-row-${row.countryCode}`}
                  aria-selected={selected}
                  tabIndex={0}
                  className={`cursor-pointer border-t border-line transition-colors duration-200 ${selected ? "bg-select/10" : "hover:bg-surface-2"}`}
                  onClick={() => toggleCountry(row.countryCode)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      toggleCountry(row.countryCode);
                    }
                  }}
                >
                  <td className="px-3 py-1.5">
                    <span className={selected ? "text-select" : ""}>{row.name}</span>
                    <span className="ml-2 font-mono text-[10px] text-faint">{row.countryCode}</span>
                  </td>
                  <td className="px-3 py-1.5 text-muted">{row.region}</td>
                  {columns.map((metric) => (
                    <td key={metric} className="px-3 py-1.5 font-mono text-[11px]">
                      {formatMetricValue(metric, row[metric])}
                    </td>
                  ))}
                </tr>
              );
            })}
            {visible.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-muted" colSpan={2 + columns.length}>
                  No countries match the current search, region, and year.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </ChartFrame>
  );
}

function SortHeader({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <th className="px-3 py-2 font-medium">
      <button type="button" className={`transition-colors duration-200 hover:text-ink ${active ? "font-medium text-ink" : "text-muted"}`} onClick={onClick}>
        {label}
      </button>
    </th>
  );
}
