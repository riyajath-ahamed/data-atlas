import { METRIC_IDS, type FocusId, type MetricId, type ScaleKind, type ViewId } from "../data/schemas/types.ts";
import {
  explorationSnapshot,
  useExplorationStore,
  type ExplorationSnapshot,
} from "./exploration-store.ts";

const VIEWS = new Set<ViewId>(["overview", "geographic", "scatter", "timeline", "correlation", "relationship", "hierarchy", "table"]);
const FOCUSES = new Set<FocusId>(["scatter", "map", "timeline", "correlation", "network", "treemap", "table"]);

function metric(value: string | null): MetricId | null {
  if (value && (METRIC_IDS as readonly string[]).includes(value)) return value as MetricId;
  return null;
}

function scale(value: string | null): ScaleKind | null {
  return value === "linear" || value === "log" ? value : null;
}

export function snapshotToParams(state: ExplorationSnapshot, defaults: ExplorationSnapshot): URLSearchParams {
  const params = new URLSearchParams();
  const set = (key: string, value: string, fallback: string) => {
    if (value !== fallback) params.set(key, value);
  };
  set("view", state.activeView, defaults.activeView);
  set("year", String(state.year), String(defaults.year));
  set("from", String(state.yearRange[0]), String(defaults.yearRange[0]));
  set("to", String(state.yearRange[1]), String(defaults.yearRange[1]));
  if (state.selectedIds.length) params.set("countries", state.selectedIds.join(","));
  if (state.regions.length) params.set("regions", state.regions.join("|"));
  set("q", state.search, "");
  set("x", state.scatterX, defaults.scatterX);
  set("y", state.scatterY, defaults.scatterY);
  set("size", state.scatterSize, defaults.scatterSize);
  set("sx", state.scaleX, defaults.scaleX);
  set("sy", state.scaleY, defaults.scaleY);
  set("opacity", String(state.opacity), String(defaults.opacity));
  if (state.showRegression !== defaults.showRegression) params.set("fit", state.showRegression ? "1" : "0");
  if (state.scatterMode !== defaults.scatterMode) params.set("mode", state.scatterMode);
  set("map", state.mapMetric, defaults.mapMetric);
  set("scheme", state.mapScheme, defaults.mapScheme);
  set("series", state.timelineMetric, defaults.timelineMetric);
  set("seriesMode", state.timelineMode, defaults.timelineMode);
  if (state.correlationMetrics.join(",") !== defaults.correlationMetrics.join(",")) {
    params.set("corr", state.correlationMetrics.join(","));
  }
  set("corrSort", state.correlationSort, defaults.correlationSort);
  set("tree", state.hierarchyMetric, defaults.hierarchyMetric);
  if (state.focusedView) params.set("focus", state.focusedView);
  return params;
}

export function paramsToSnapshot(params: URLSearchParams, base: ExplorationSnapshot): Partial<ExplorationSnapshot> {
  const patch: Partial<ExplorationSnapshot> = {};
  const view = params.get("view");
  if (view && VIEWS.has(view as ViewId)) patch.activeView = view as ViewId;
  if (params.has("year")) {
    const year = Number(params.get("year"));
    if (Number.isInteger(year)) patch.year = year;
  }
  if (params.has("from") && params.has("to")) {
    const from = Number(params.get("from"));
    const to = Number(params.get("to"));
    if (Number.isInteger(from) && Number.isInteger(to)) {
      patch.yearRange = [Math.min(from, to), Math.max(from, to)];
    }
  }
  if (params.has("countries")) {
    patch.selectedIds = params
      .get("countries")!
      .split(",")
      .map((code) => code.trim())
      .filter((code) => /^[A-Z]{3}$/.test(code));
  }
  if (params.has("regions")) {
    patch.regions = params
      .get("regions")!
      .split("|")
      .map((region) => region.trim())
      .filter(Boolean);
  }
  if (params.has("q")) patch.search = params.get("q") ?? "";
  const x = metric(params.get("x"));
  const y = metric(params.get("y"));
  const size = metric(params.get("size"));
  if (x) patch.scatterX = x;
  if (y) patch.scatterY = y;
  if (size) patch.scatterSize = size;
  const sx = scale(params.get("sx"));
  const sy = scale(params.get("sy"));
  if (sx) patch.scaleX = sx;
  if (sy) patch.scaleY = sy;
  const opacity = Number(params.get("opacity"));
  if (Number.isFinite(opacity) && opacity > 0 && opacity <= 1) patch.opacity = opacity;
  if (params.get("fit") === "1") patch.showRegression = true;
  if (params.get("fit") === "0") patch.showRegression = false;
  if (params.get("mode") === "brush" || params.get("mode") === "pan") patch.scatterMode = params.get("mode") as "brush" | "pan";
  const map = metric(params.get("map"));
  if (map) patch.mapMetric = map;
  if (params.get("scheme") === "sequential" || params.get("scheme") === "diverging") {
    patch.mapScheme = params.get("scheme") as "sequential" | "diverging";
  }
  const series = metric(params.get("series"));
  if (series) patch.timelineMetric = series;
  if (params.get("seriesMode") === "line" || params.get("seriesMode") === "area") {
    patch.timelineMode = params.get("seriesMode") as "line" | "area";
  }
  if (params.has("corr")) {
    const metrics = params
      .get("corr")!
      .split(",")
      .map((item) => metric(item))
      .filter((item): item is MetricId => item != null);
    if (metrics.length >= 2) patch.correlationMetrics = metrics;
  }
  if (params.get("corrSort") === "name" || params.get("corrSort") === "similarity") {
    patch.correlationSort = params.get("corrSort") as "name" | "similarity";
  }
  const tree = metric(params.get("tree"));
  if (tree) patch.hierarchyMetric = tree;
  const focus = params.get("focus");
  if (focus && FOCUSES.has(focus as FocusId)) patch.focusedView = focus as FocusId;
  return { ...base, ...patch };
}

const PUSH_KEYS: (keyof ExplorationSnapshot)[] = [
  "activeView",
  "selectedIds",
  "regions",
  "scatterX",
  "scatterY",
  "scatterSize",
  "scaleX",
  "scaleY",
  "showRegression",
  "mapMetric",
  "mapScheme",
  "timelineMetric",
  "timelineMode",
  "correlationMetrics",
  "correlationSort",
  "hierarchyMetric",
  "focusedView",
];

function shouldPush(previous: ExplorationSnapshot, next: ExplorationSnapshot): boolean {
  return PUSH_KEYS.some((key) => JSON.stringify(previous[key]) !== JSON.stringify(next[key]));
}

export function bindExplorationUrl(getDefaults: () => ExplorationSnapshot): () => void {
  let applying = false;
  const applyFromLocation = () => {
    applying = true;
    const patch = paramsToSnapshot(new URLSearchParams(window.location.search), getDefaults());
    useExplorationStore.getState().applySnapshot(patch);
    applying = false;
  };
  applyFromLocation();
  const onPop = () => applyFromLocation();
  window.addEventListener("popstate", onPop);
  const unsubscribe = useExplorationStore.subscribe((state, previous) => {
    if (applying) return;
    const next = snapshotToParams(explorationSnapshot(state), getDefaults());
    const current = window.location.search.startsWith("?") ? window.location.search.slice(1) : window.location.search;
    if (next.toString() === current) return;
    const url = `${window.location.pathname}${next.toString() ? `?${next}` : ""}`;
    if (shouldPush(explorationSnapshot(previous), explorationSnapshot(state))) {
      window.history.pushState(null, "", url);
    } else {
      window.history.replaceState(null, "", url);
    }
  });
  return () => {
    window.removeEventListener("popstate", onPop);
    unsubscribe();
  };
}
