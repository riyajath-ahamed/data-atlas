import { quantile } from "d3-array";

export interface Fences {
  low: number;
  high: number;
}

export function iqrFences(values: readonly number[]): Fences | null {
  if (values.length < 4) return null;
  const q1 = quantile(values, 0.25);
  const q3 = quantile(values, 0.75);
  if (q1 == null || q3 == null) return null;
  const iqr = q3 - q1;
  return { low: q1 - 1.5 * iqr, high: q3 + 1.5 * iqr };
}

export function isOutsideFences(value: number, fences: Fences | null): boolean {
  if (!fences || !Number.isFinite(value)) return false;
  return value < fences.low || value > fences.high;
}
