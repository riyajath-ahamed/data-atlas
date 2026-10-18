import { create } from "zustand";
import {
  METRIC_IDS,
  type FocusId,
  type MetricId,
  type ScaleKind,
  type ViewId,
} from "../data/schemas/types.ts";

export interface ExplorationSnapshot {
  year: number;
  yearRange: [number, number];
  selectedIds: string[];
  regions: string[];
  search: string;
  scatterX: MetricId;
  scatterY: MetricId;
  scatterSize: MetricId;
  scaleX: ScaleKind;
  scaleY: ScaleKind;
  opacity: number;
  showRegression: boolean;
  scatterMode: "brush" | "pan";
  mapMetric: MetricId;
  mapScheme: "sequential" | "diverging";
  timelineMetric: MetricId;
  timelineMode: "line" | "area";
  correlationMetrics: MetricId[];
  correlationSort: "name" | "similarity";
  hierarchyMetric: MetricId;
  activeView: ViewId;
  focusedView: FocusId | null;
  theme: "dark" | "light";
}

interface ExplorationStore extends ExplorationSnapshot {
  yearMin: number;
  yearMax: number;
  playing: boolean;
  setYear: (year: number) => void;
  setYearRange: (range: [number, number]) => void;
  toggleCountry: (countryCode: string) => void;
  setSelected: (countryCodes: string[]) => void;
  clearSelection: () => void;
  setRegions: (regions: string[]) => void;
  toggleRegion: (region: string) => void;
  setSearch: (search: string) => void;
  setScatterX: (metric: MetricId) => void;
  setScatterY: (metric: MetricId) => void;
  setScatterSize: (metric: MetricId) => void;
  setScaleX: (scale: ScaleKind) => void;
  setScaleY: (scale: ScaleKind) => void;
  setOpacity: (opacity: number) => void;
  setShowRegression: (show: boolean) => void;
  setScatterMode: (mode: "brush" | "pan") => void;
  setMapMetric: (metric: MetricId) => void;
  setMapScheme: (scheme: "sequential" | "diverging") => void;
  setTimelineMetric: (metric: MetricId) => void;
  setTimelineMode: (mode: "line" | "area") => void;
  toggleCorrelationMetric: (metric: MetricId) => void;
  setCorrelationSort: (sort: "name" | "similarity") => void;
  setHierarchyMetric: (metric: MetricId) => void;
  setActiveView: (view: ViewId) => void;
  setFocusedView: (view: FocusId | null) => void;
  setTheme: (theme: "dark" | "light") => void;
  setPlaying: (playing: boolean) => void;
  stepYear: () => boolean;
  resetExploration: () => void;
  hydrateYears: (min: number, max: number, defaultYear: number, keepCurrent: boolean) => void;
  applySnapshot: (patch: Partial<ExplorationSnapshot>) => void;
}

const snapshot = {
  year: 2019,
  yearRange: [1990, 2023] as [number, number],
  selectedIds: [] as string[],
  regions: [] as string[],
  search: "",
  scatterX: "gdpPerCapita" as MetricId,
  scatterY: "lifeExpectancy" as MetricId,
  scatterSize: "population" as MetricId,
  scaleX: "log" as ScaleKind,
  scaleY: "linear" as ScaleKind,
  opacity: 0.85,
  showRegression: false,
  scatterMode: "brush" as const,
  mapMetric: "gdpPerCapita" as MetricId,
  mapScheme: "sequential" as const,
  timelineMetric: "lifeExpectancy" as MetricId,
  timelineMode: "line" as const,
  correlationMetrics: [...METRIC_IDS],
  correlationSort: "name" as const,
  hierarchyMetric: "population" as MetricId,
  activeView: "overview" as ViewId,
  focusedView: null,
  theme: "light" as const,
};

function clampYear(year: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(year)));
}

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.every((id, index) => id === sortedRight[index]);
}

export const useExplorationStore = create<ExplorationStore>((set, get) => ({
  ...snapshot,
  yearMin: snapshot.yearRange[0],
  yearMax: snapshot.yearRange[1],
  playing: false,
  setYear: (year) => {
    const { yearMin, yearMax, yearRange } = get();
    const next = clampYear(year, yearRange[0], yearRange[1]);
    const bounded = clampYear(next, yearMin, yearMax);
    if (bounded !== get().year) set({ year: bounded });
  },
  setYearRange: (range) => {
    const { yearMin, yearMax, year } = get();
    const from = clampYear(Math.min(range[0], range[1]), yearMin, yearMax);
    const to = clampYear(Math.max(range[0], range[1]), yearMin, yearMax);
    const nextYear = clampYear(year, from, to);
    if (from === get().yearRange[0] && to === get().yearRange[1] && nextYear === year) return;
    set({ yearRange: [from, to], year: nextYear });
  },
  toggleCountry: (countryCode) => {
    const selected = get().selectedIds;
    const next = selected.includes(countryCode)
      ? selected.filter((id) => id !== countryCode)
      : [...selected, countryCode];
    set({ selectedIds: next });
  },
  setSelected: (countryCodes) => {
    const unique = [...new Set(countryCodes)];
    if (!sameIds(unique, get().selectedIds)) set({ selectedIds: unique });
  },
  clearSelection: () => {
    if (get().selectedIds.length) set({ selectedIds: [] });
  },
  setRegions: (regions) => set({ regions: [...new Set(regions)] }),
  toggleRegion: (region) => {
    const regions = get().regions;
    set({
      regions: regions.includes(region) ? regions.filter((item) => item !== region) : [...regions, region],
    });
  },
  setSearch: (search) => {
    if (search !== get().search) set({ search });
  },
  setScatterX: (metric) => set({ scatterX: metric }),
  setScatterY: (metric) => set({ scatterY: metric }),
  setScatterSize: (metric) => set({ scatterSize: metric }),
  setScaleX: (scale) => set({ scaleX: scale }),
  setScaleY: (scale) => set({ scaleY: scale }),
  setOpacity: (opacity) => set({ opacity: Math.min(1, Math.max(0.15, opacity)) }),
  setShowRegression: (show) => set({ showRegression: show }),
  setScatterMode: (mode) => set({ scatterMode: mode }),
  setMapMetric: (metric) => set({ mapMetric: metric }),
  setMapScheme: (scheme) => set({ mapScheme: scheme }),
  setTimelineMetric: (metric) => set({ timelineMetric: metric }),
  setTimelineMode: (mode) => set({ timelineMode: mode }),
  toggleCorrelationMetric: (metric) => {
    const current = get().correlationMetrics;
    if (current.includes(metric)) {
      if (current.length <= 2) return;
      set({ correlationMetrics: current.filter((item) => item !== metric) });
      return;
    }
    set({ correlationMetrics: METRIC_IDS.filter((item) => current.includes(item) || item === metric) });
  },
  setCorrelationSort: (sort) => set({ correlationSort: sort }),
  setHierarchyMetric: (metric) => set({ hierarchyMetric: metric }),
  setActiveView: (view) => set({ activeView: view, focusedView: null }),
  setFocusedView: (view) => set({ focusedView: view }),
  setTheme: (theme) => set({ theme }),
  setPlaying: (playing) => set({ playing }),
  stepYear: () => {
    const { year, yearRange } = get();
    if (year >= yearRange[1]) return false;
    set({ year: year + 1 });
    return true;
  },
  resetExploration: () => {
    const { theme, yearMin, yearMax } = get();
    set({
      ...snapshot,
      theme,
      yearMin,
      yearMax,
      year: yearMax,
      yearRange: [yearMin, yearMax],
      playing: false,
      correlationMetrics: [...METRIC_IDS],
    });
  },
  hydrateYears: (min, max, defaultYear, keepCurrent) => {
    const yearMin = Math.min(min, max);
    const yearMax = Math.max(min, max);
    if (keepCurrent) {
      const from = clampYear(get().yearRange[0], yearMin, yearMax);
      const to = clampYear(get().yearRange[1], yearMin, yearMax);
      set({
        yearMin,
        yearMax,
        yearRange: [Math.min(from, to), Math.max(from, to)],
        year: clampYear(get().year, Math.min(from, to), Math.max(from, to)),
      });
      return;
    }
    const year = clampYear(defaultYear, yearMin, yearMax);
    set({ yearMin, yearMax, year, yearRange: [yearMin, yearMax] });
  },
  applySnapshot: (patch) => set(patch),
}));

export function explorationSnapshot(state: ExplorationSnapshot): ExplorationSnapshot {
  return {
    year: state.year,
    yearRange: [...state.yearRange] as [number, number],
    selectedIds: [...state.selectedIds],
    regions: [...state.regions],
    search: state.search,
    scatterX: state.scatterX,
    scatterY: state.scatterY,
    scatterSize: state.scatterSize,
    scaleX: state.scaleX,
    scaleY: state.scaleY,
    opacity: state.opacity,
    showRegression: state.showRegression,
    scatterMode: state.scatterMode,
    mapMetric: state.mapMetric,
    mapScheme: state.mapScheme,
    timelineMetric: state.timelineMetric,
    timelineMode: state.timelineMode,
    correlationMetrics: [...state.correlationMetrics],
    correlationSort: state.correlationSort,
    hierarchyMetric: state.hierarchyMetric,
    activeView: state.activeView,
    focusedView: state.focusedView,
    theme: state.theme,
  };
}
