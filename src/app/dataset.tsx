import { createContext, useCallback, useContext, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import countries from "../data/datasets/countries.json";
import meta from "../data/datasets/meta.json";
import topology from "../data/datasets/countries-110m.json";
import observationsCsv from "../data/datasets/observations.csv?raw";
import { adjacencyLinks, countryShapes, type CountryShape, type WorldTopology } from "../data/geo.ts";
import { fetchWorldBankSample, type AssembledSample } from "../data/ingestion/fetchWorldBank.ts";
import { assertValidCountries, parseObservations } from "../data/ingestion/parseObservations.ts";
import type { CountryMetadata, DatasetMeta, ValidationIssue } from "../data/schemas/types.ts";
import { buildIndex, type DatasetIndex } from "../engine/indexing/buildIndex.ts";
import type { AdjacencyLink } from "../data/geo.ts";
import { explorationSnapshot, useExplorationStore } from "../state/exploration-store.ts";
import { bindExplorationUrl } from "../state/url-sync.ts";

export interface LoadedDataset {
  meta: DatasetMeta;
  index: DatasetIndex;
  shapes: CountryShape[];
  links: AdjacencyLink[];
  issues: ValidationIssue[];
}

interface DatasetRefresh {
  source: "bundled" | "live";
  status: "idle" | "loading" | "error";
  message: string | null;
  refresh: () => Promise<void>;
}

const DatasetContext = createContext<LoadedDataset | null>(null);
const RefreshContext = createContext<DatasetRefresh | null>(null);
const bundledCountries = countries as CountryMetadata[];
const isoByCode = new Map(bundledCountries.map((country) => [country.countryCode, country.isoNumeric]));
const worldTopology = topology as unknown as WorldTopology;

export function useDataset(): LoadedDataset {
  const value = useContext(DatasetContext);
  if (!value) throw new Error("Dataset is not loaded.");
  return value;
}

export function useDatasetRefresh(): DatasetRefresh {
  const value = useContext(RefreshContext);
  if (!value) throw new Error("Dataset is not loaded.");
  return value;
}

export function loadBundledDataset(): LoadedDataset {
  const issues = assertValidCountries(bundledCountries);
  const parsed = parseObservations(observationsCsv);
  if (parsed.issues.some((issue) => issue.level === "error")) {
    throw new Error(parsed.issues.map((issue) => issue.message).join("\n"));
  }
  const index = buildIndex(bundledCountries, parsed.observations, [...issues, ...parsed.issues]);
  return {
    meta: meta as DatasetMeta,
    index,
    shapes: countryShapes(worldTopology, bundledCountries),
    links: adjacencyLinks(worldTopology, bundledCountries),
    issues: index.issues,
  };
}

function datasetFromSample(sample: AssembledSample): LoadedDataset {
  const issues = assertValidCountries(sample.countries);
  const index = buildIndex(sample.countries, sample.observations, issues);
  const shapes = countryShapes(worldTopology, sample.countries);
  const matched = new Set(shapes.map((shape) => shape.countryCode).filter((code): code is string => code != null));
  return {
    meta: {
      ...sample.meta,
      unmatchedGeometryIds: shapes
        .filter((shape) => shape.countryCode == null)
        .map((shape) => String(shape.feature.id ?? "")),
      countriesWithoutGeometry: sample.countries
        .filter((country) => !matched.has(country.countryCode))
        .map((country) => country.countryCode),
    },
    index,
    shapes,
    links: adjacencyLinks(worldTopology, sample.countries),
    issues: index.issues,
  };
}

export function DatasetProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState(() => {
    try {
      return { dataset: loadBundledDataset(), error: null as string | null };
    } catch (caught) {
      return {
        dataset: null,
        error: caught instanceof Error ? caught.message : "The bundled dataset could not be read.",
      };
    }
  });
  const [refreshState, setRefreshState] = useState<Omit<DatasetRefresh, "refresh">>({
    source: "bundled",
    status: "idle",
    message: null,
  });
  const refreshing = useRef(false);
  const dataset = loaded.dataset;
  const error = loaded.error;
  const defaultsRef = useRef(explorationSnapshot(useExplorationStore.getState()));
  const refresh = useCallback(async () => {
    if (refreshing.current) return;
    refreshing.current = true;
    setRefreshState((current) => ({ ...current, status: "loading", message: "Contacting the World Bank…" }));
    try {
      const sample = await fetchWorldBankSample({
        isoByCode,
        onProgress: (message) => setRefreshState((current) => ({ ...current, status: "loading", message })),
      });
      setLoaded({ dataset: datasetFromSample(sample), error: null });
      setRefreshState({ source: "live", status: "idle", message: null });
    } catch (caught) {
      setRefreshState((current) => ({
        ...current,
        status: "error",
        message: caught instanceof Error ? caught.message : "The World Bank request failed. The current sample is still loaded.",
      }));
    } finally {
      refreshing.current = false;
    }
  }, []);

  useLayoutEffect(() => {
    if (dataset) {
      const years = dataset.index.years;
      const min = years[0] ?? dataset.meta.yearStart;
      const max = years[years.length - 1] ?? dataset.meta.yearEnd;
      defaultsRef.current = {
        ...defaultsRef.current,
        year: dataset.meta.defaultYear,
        yearRange: [min, max],
      };
      useExplorationStore.getState().hydrateYears(min, max, dataset.meta.defaultYear, false);
    }
    const stop = bindExplorationUrl(() => defaultsRef.current);
    document.documentElement.dataset.theme = "light";
    return () => {
      stop();
    };
  }, [dataset]);

  if (error) {
    return (
      <div className="flex h-svh items-center justify-center bg-canvas px-6 text-center text-ink">
        <div>
          <h1 className="font-display text-[2rem] leading-[1.19] font-bold tracking-tight">The bundled sample did not load</h1>
          <p className="mx-auto mt-3 max-w-[36rem] text-pretty text-sm leading-relaxed text-muted">{error}</p>
          <button type="button" className="btn-solid mt-5" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      </div>
    );
  }
  if (!dataset) {
    return (
      <div className="flex h-svh flex-col bg-canvas text-ink" aria-busy="true">
        <div className="h-16 border-b border-line bg-surface" />
        <div className="flex min-h-0 flex-1">
          <div className="hidden w-56 flex-col gap-2 border-r border-line bg-surface px-4 py-5 md:flex">
            <div className="mb-4 h-7 w-32 animate-pulse rounded-[3px] bg-surface-2" />
            {Array.from({ length: 8 }, (_, index) => (
              <div key={index} className="h-7 animate-pulse rounded-[3px] bg-surface-2" />
            ))}
          </div>
          <div className="grid min-w-0 flex-1 gap-3 p-4 xl:grid-cols-5">
            <div className="h-72 animate-pulse rounded-lg bg-surface xl:col-span-3" />
            <div className="h-72 animate-pulse rounded-lg bg-surface xl:col-span-2" />
            <div className="h-40 animate-pulse rounded-lg bg-surface xl:col-span-3" />
            <div className="h-40 animate-pulse rounded-lg bg-surface xl:col-span-2" />
          </div>
        </div>
        <p className="sr-only">Loading the World Bank sample</p>
      </div>
    );
  }
  return (
    <RefreshContext.Provider value={{ ...refreshState, refresh }}>
      <DatasetContext.Provider value={dataset}>{children}</DatasetContext.Provider>
    </RefreshContext.Provider>
  );
}
