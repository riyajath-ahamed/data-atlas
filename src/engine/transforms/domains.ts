import { extent } from "d3-array";
import type { ScaleKind } from "../../data/schemas/types.ts";

export function finiteValues(values: readonly (number | null | undefined)[], scale: ScaleKind = "linear"): number[] {
  return values.filter((value): value is number => {
    if (value == null || !Number.isFinite(value)) return false;
    return scale !== "log" || value > 0;
  });
}

export function paddedDomain(values: readonly number[], scale: ScaleKind): [number, number] | null {
  const usable = finiteValues(values, scale);
  if (usable.length === 0) return null;
  const [min, max] = extent(usable) as [number, number];
  if (min === max) {
    if (scale === "log") return [min / 1.5, max * 1.5];
    const pad = Math.abs(min) * 0.08 || 1;
    return [min - pad, max + pad];
  }
  if (scale === "log") return [min, max];
  const pad = (max - min) * 0.06;
  return [min - pad, max + pad];
}
