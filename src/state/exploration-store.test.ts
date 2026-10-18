import { beforeEach, describe, expect, it } from "vitest";
import { useExplorationStore } from "./exploration-store.ts";
import { paramsToSnapshot, snapshotToParams } from "./url-sync.ts";
import { explorationSnapshot } from "./exploration-store.ts";

describe("exploration store", () => {
  beforeEach(() => {
    useExplorationStore.getState().resetExploration();
    useExplorationStore.getState().hydrateYears(1990, 2022, 2022, false);
  });

  it("toggles selection without duplicates and clamps the year into the range", () => {
    useExplorationStore.getState().setYearRange([2000, 2010]);
    useExplorationStore.getState().setYear(1990);
    expect(useExplorationStore.getState().year).toBe(2000);
    useExplorationStore.getState().toggleCountry("JPN");
    useExplorationStore.getState().toggleCountry("JPN");
    expect(useExplorationStore.getState().selectedIds).toEqual([]);
    useExplorationStore.getState().setSelected(["NOR", "NOR", "JPN"]);
    expect(useExplorationStore.getState().selectedIds).toEqual(["NOR", "JPN"]);
  });

  it("keeps at least two correlation metrics and resets exploration", () => {
    const { toggleCorrelationMetric, resetExploration, correlationMetrics } = useExplorationStore.getState();
    for (const metric of correlationMetrics) toggleCorrelationMetric(metric);
    expect(useExplorationStore.getState().correlationMetrics.length).toBeGreaterThanOrEqual(2);
    useExplorationStore.getState().setSearch("japan");
    resetExploration();
    expect(useExplorationStore.getState().search).toBe("");
    expect(useExplorationStore.getState().year).toBe(2022);
  });
});

describe("url sync", () => {
  it("round-trips a partial exploration and ignores invalid metrics", () => {
    const base = explorationSnapshot(useExplorationStore.getState());
    const params = snapshotToParams(
      { ...base, year: 2008, scatterX: "population", selectedIds: ["JPN", "NOR"], activeView: "geographic" },
      base,
    );
    const restored = paramsToSnapshot(params, base);
    expect(restored.year).toBe(2008);
    expect(restored.scatterX).toBe("population");
    expect(restored.selectedIds).toEqual(["JPN", "NOR"]);
    expect(restored.activeView).toBe("geographic");
    const invalid = paramsToSnapshot(new URLSearchParams("x=not-a-metric&year=2011"), base);
    expect(invalid.scatterX).toBe(base.scatterX);
    expect(invalid.year).toBe(2011);
    const absent = paramsToSnapshot(new URLSearchParams("view=timeline"), base);
    expect(absent.year).toBe(base.year);
    expect(absent.yearRange).toEqual(base.yearRange);
  });
});
