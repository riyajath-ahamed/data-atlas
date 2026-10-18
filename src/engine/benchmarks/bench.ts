import { correlationMatrix } from "../statistics/correlation.ts";
import { finiteValues } from "../transforms/domains.ts";
import { METRIC_IDS, type MetricId } from "../../data/schemas/types.ts";
import { syntheticRows } from "./synthetic.ts";

export interface BenchResult {
  label: string;
  rows: number;
  milliseconds: number;
}

function time(label: string, rows: number, run: () => void): BenchResult {
  const start = performance.now();
  run();
  return { label, rows, milliseconds: performance.now() - start };
}

export function runProcessingBenchmarks(): BenchResult[] {
  const small = syntheticRows(8_000);
  const large = syntheticRows(50_000);
  return [
    time("filter synthetic observations", small.length, () => {
      small.filter((row) => (row.lifeExpectancy ?? 0) > 70 && (row.gdpPerCapita ?? 0) > 1000);
    }),
    time("pearson matrix, 6 indicators", small.length, () => {
      correlationMatrix(small, METRIC_IDS);
    }),
    time("filter 50k synthetic observations", large.length, () => {
      large.filter((row) => (row.gdpPerCapita ?? 0) > 5000);
    }),
    time("project 50k scatter positions", large.length, () => {
      project(large, "gdpPerCapita", "lifeExpectancy");
    }),
    time("pearson matrix, 50k rows", large.length, () => {
      correlationMatrix(large, METRIC_IDS);
    }),
  ];
}

function project(rows: readonly Record<MetricId, number | null>[], x: MetricId, y: MetricId): number {
  const xs = finiteValues(rows.map((row) => row[x]), "log");
  const ys = finiteValues(rows.map((row) => row[y]));
  if (xs.length === 0 || ys.length === 0) return 0;
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  let sink = 0;
  for (const row of rows) {
    const xv = row[x];
    const yv = row[y];
    if (xv == null || yv == null || xv <= 0) continue;
    const px = ((Math.log(xv) - Math.log(xMin)) / (Math.log(xMax) - Math.log(xMin))) * 800;
    const py = (1 - (yv - yMin) / (yMax - yMin)) * 500;
    sink += px + py;
  }
  return sink;
}
