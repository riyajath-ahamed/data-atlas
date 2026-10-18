import { useEffect, useMemo, useState } from "react";
import { useDataset, useDatasetRefresh } from "../../app/dataset.tsx";
import { countryMatchesSearch } from "../../engine/transforms/filter.ts";
import { useExplorationStore } from "../../state/exploration-store.ts";
import { downloadFilteredCsv } from "../../utils/exportCsv.ts";

export function TopBar() {
  const dataset = useDataset();
  const search = useExplorationStore((state) => state.search);
  const setSearch = useExplorationStore((state) => state.setSearch);
  const year = useExplorationStore((state) => state.year);
  const yearRange = useExplorationStore((state) => state.yearRange);
  const yearMin = useExplorationStore((state) => state.yearMin);
  const yearMax = useExplorationStore((state) => state.yearMax);
  const setYear = useExplorationStore((state) => state.setYear);
  const setYearRange = useExplorationStore((state) => state.setYearRange);
  const regions = useExplorationStore((state) => state.regions);
  const toggleRegion = useExplorationStore((state) => state.toggleRegion);
  const selectedIds = useExplorationStore((state) => state.selectedIds);
  const toggleCountry = useExplorationStore((state) => state.toggleCountry);
  const clearSelection = useExplorationStore((state) => state.clearSelection);
  const reset = useExplorationStore((state) => state.resetExploration);
  const { refresh, status: refreshStatus, message: refreshMessage, source } = useDatasetRefresh();
  const [draft, setDraft] = useState(search);
  const [syncedSearch, setSyncedSearch] = useState(search);
  const [highlight, setHighlight] = useState(0);
  if (search !== syncedSearch) {
    setSyncedSearch(search);
    setDraft(search);
  }

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (draft !== search) setSearch(draft);
    }, 150);
    return () => window.clearTimeout(handle);
  }, [draft, search, setSearch]);

  const suggestions = useMemo(() => {
    const query = draft.trim();
    if (!query) return [];
    return dataset.index.countries.filter((country) => countryMatchesSearch(country, query)).slice(0, 6);
  }, [dataset, draft]);

  const selectedNames = selectedIds
    .map((code) => dataset.index.countryByCode.get(code)?.name ?? code)
    .slice(0, 3);

  return (
    <header className="relative z-30 w-full min-w-0 border-b border-line bg-surface px-3 pt-2.5 pb-2">
      <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-2">
        <p className="font-display text-lg leading-[1.19] font-bold tracking-tight md:hidden">Data Atlas</p>
        <label className="text-[11px] text-muted">
          Dataset
          <select data-testid="dataset-select" className="field ml-1.5 text-[12px]" defaultValue={dataset.meta.id}>
            <option value={dataset.meta.id}>{source === "live" ? "World Bank WDI, fetched" : "World Bank WDI, bundled"}</option>
          </select>
        </label>
        <div className="relative">
          <label className="text-[11px] text-muted" htmlFor="atlas-search">
            Search
          </label>
          <input
            id="atlas-search"
            data-testid="search-input"
            className="field ml-1.5 w-40 text-[13px] md:w-48"
            value={draft}
            placeholder="Country or code"
            role="combobox"
            aria-expanded={suggestions.length > 0}
            aria-controls="search-suggestions"
            onChange={(event) => {
              setDraft(event.target.value);
              setHighlight(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setHighlight((index) => Math.min(suggestions.length - 1, index + 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setHighlight((index) => Math.max(0, index - 1));
              } else if (event.key === "Enter" && suggestions[highlight]) {
                event.preventDefault();
                toggleCountry(suggestions[highlight].countryCode);
              } else if (event.key === "Escape") {
                setDraft("");
                setSearch("");
              }
            }}
          />
          {suggestions.length > 0 ? (
            <ul id="search-suggestions" role="listbox" className="menu absolute z-30 mt-1 w-64 py-1 text-[12px]">
              {suggestions.map((country, index) => (
                <li key={country.countryCode}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === highlight}
                    className={`block w-full px-2.5 py-1.5 text-left transition-colors duration-150 ${index === highlight ? "bg-surface-2" : "hover:bg-surface-2"}`}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      toggleCountry(country.countryCode);
                    }}
                  >
                    {country.name}
                    <span className="ml-2 font-mono text-[10px] text-faint">{country.countryCode}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <details className="relative text-[11px] text-muted">
          <summary className="field cursor-pointer text-[12px]">Regions{regions.length ? ` (${regions.length})` : ""}</summary>
          <div className="menu absolute z-30 mt-1 max-h-64 w-64 overflow-auto p-1.5">
            {dataset.index.regions.map((region) => (
              <label key={region} className="flex items-center gap-2 rounded-[3px] px-1.5 py-1 hover:bg-surface-2">
                <input type="checkbox" checked={regions.includes(region)} onChange={() => toggleRegion(region)} />
                {region}
              </label>
            ))}
          </div>
        </details>
        <div className="flex flex-wrap items-center gap-2 rounded-[4px] bg-canvas px-2 py-1 ring-1 ring-line">
          <label className="flex items-center gap-1.5 text-[11px] text-muted">
            Year
            <input
              data-testid="year-slider"
              className="w-28 max-w-full"
              type="range"
              min={yearRange[0]}
              max={yearRange[1]}
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
            />
            <span className="font-mono text-[12px] text-ink">{year}</span>
          </label>
          <label className="text-[11px] text-muted">
            From
            <input
              data-testid="year-from"
              className="field ml-1 w-16 font-mono text-[12px]"
              type="number"
              min={yearMin}
              max={yearMax}
              value={yearRange[0]}
              onChange={(event) => setYearRange([Number(event.target.value), yearRange[1]])}
            />
          </label>
          <label className="text-[11px] text-muted">
            To
            <input
              data-testid="year-to"
              className="field ml-1 w-16 font-mono text-[12px]"
              type="number"
              min={yearMin}
              max={yearMax}
              value={yearRange[1]}
              onChange={(event) => setYearRange([yearRange[0], Number(event.target.value)])}
            />
          </label>
        </div>
        <div data-testid="selected-count" className="flex items-center gap-1.5 text-[11px]">
          {selectedIds.length === 0 ? (
            <span className="text-muted">No selection</span>
          ) : (
            <>
              {selectedNames.map((name) => (
                <span key={name} className="rounded-[3px] bg-tint px-1.5 py-0.5 text-primary">
                  {name}
                </span>
              ))}
              {selectedIds.length > selectedNames.length ? (
                <span className="font-mono text-muted">+{selectedIds.length - selectedNames.length}</span>
              ) : null}
              <button type="button" className="btn-quiet text-[11px]" onClick={clearSelection}>
                Clear
              </button>
            </>
          )}
        </div>
        <div className="flex basis-full items-center gap-1.5 sm:ml-auto sm:basis-auto">
          <button type="button" data-testid="reset-exploration" className="btn-quiet text-[12px]" onClick={reset}>
            Reset
          </button>
          <button
            type="button"
            data-testid="fetch-latest"
            className="btn-solid text-[12px]"
            disabled={refreshStatus === "loading"}
            aria-busy={refreshStatus === "loading"}
            onClick={() => void refresh()}
          >
            {refreshStatus === "loading" ? "Fetching…" : "Fetch latest"}
          </button>
          <button
            type="button"
            data-testid="export-csv"
            className="btn-solid text-[12px]"
            onClick={() =>
              downloadFilteredCsv(dataset.index, {
                yearRange,
                regions,
                search,
              })
            }
          >
            Export CSV
          </button>
        </div>
      </div>
      {refreshStatus === "loading" ? (
        <p className="mt-2 border-t border-line pt-1.5 text-[11px] leading-relaxed text-muted" role="status">
          {refreshMessage}
        </p>
      ) : refreshStatus === "error" ? (
        <p className="mt-2 border-t border-line pt-1.5 text-[11px] leading-relaxed text-select" role="alert">
          {refreshMessage}
        </p>
      ) : source === "live" ? (
        <p className="mt-2 border-t border-line pt-1.5 text-[11px] leading-relaxed text-faint">
          Fetched from the World Bank on {dataset.meta.retrieved}. {dataset.meta.observationCount.toLocaleString()} observations through {dataset.meta.yearEnd}. This replaces the sample for this session only.
        </p>
      ) : dataset.issues.some((issue) => issue.level === "warning") ? (
        <p className="mt-2 border-t border-line pt-1.5 text-[11px] leading-relaxed text-muted">
          {dataset.issues.length} data warnings. Values were not replaced with zero.
        </p>
      ) : (
        <p className="mt-2 border-t border-line pt-1.5 text-[11px] leading-relaxed text-faint">
          Bundled World Bank WDI through {dataset.meta.retrieved}. Use Fetch latest to request a new extract.
        </p>
      )}
    </header>
  );
}
