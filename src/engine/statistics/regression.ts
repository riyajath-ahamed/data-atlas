export interface Regression {
  slope: number;
  intercept: number;
  n: number;
}

/** Ordinary least squares in the coordinates already transformed for display. */
export function linearRegression(xs: readonly number[], ys: readonly number[]): Regression | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return null;
  let sx = 0;
  let sy = 0;
  for (let index = 0; index < n; index += 1) {
    const x = xs[index];
    const y = ys[index];
    if (x == null || y == null) return null;
    sx += x;
    sy += y;
  }
  const meanX = sx / n;
  const meanY = sy / n;
  let numerator = 0;
  let denominator = 0;
  for (let index = 0; index < n; index += 1) {
    const x = xs[index] ?? 0;
    const y = ys[index] ?? 0;
    const dx = x - meanX;
    numerator += dx * (y - meanY);
    denominator += dx * dx;
  }
  if (denominator === 0) return null;
  const slope = numerator / denominator;
  return { slope, intercept: meanY - slope * meanX, n };
}
