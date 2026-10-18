import { studentTTwoTailedP } from "./studentT.ts";

export interface CorrelationResult {
  r: number;
  n: number;
  t: number | null;
  df: number | null;
  p: number | null;
}

export function pearson(xs: readonly number[], ys: readonly number[]): { r: number; n: number } | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return null;
  let sumX = 0;
  let sumY = 0;
  for (let index = 0; index < n; index += 1) {
    const x = xs[index];
    const y = ys[index];
    if (x == null || y == null || !Number.isFinite(x) || !Number.isFinite(y)) return null;
    sumX += x;
    sumY += y;
  }
  const meanX = sumX / n;
  const meanY = sumY / n;
  let covariance = 0;
  let varianceX = 0;
  let varianceY = 0;
  for (let index = 0; index < n; index += 1) {
    const dx = (xs[index] ?? 0) - meanX;
    const dy = (ys[index] ?? 0) - meanY;
    covariance += dx * dy;
    varianceX += dx * dx;
    varianceY += dy * dy;
  }
  if (varianceX === 0 || varianceY === 0) return null;
  const r = covariance / Math.sqrt(varianceX * varianceY);
  return { r: Math.max(-1, Math.min(1, r)), n };
}

export function correlatePair(xs: readonly number[], ys: readonly number[]): CorrelationResult | null {
  const result = pearson(xs, ys);
  if (!result) return null;
  if (result.n < 4 || Math.abs(result.r) === 1) {
    return {
      r: result.r,
      n: result.n,
      t: Math.abs(result.r) === 1 ? Number.POSITIVE_INFINITY : null,
      df: result.n - 2,
      p: Math.abs(result.r) === 1 ? 0 : null,
    };
  }
  const df = result.n - 2;
  const t = (result.r * Math.sqrt(df)) / Math.sqrt(1 - result.r * result.r);
  return { ...result, t, df, p: studentTTwoTailedP(t, df) };
}

export function pairwiseComplete(
  rows: readonly Record<string, number | null>[],
  left: string,
  right: string,
): { xs: number[]; ys: number[] } {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const row of rows) {
    const x = row[left];
    const y = row[right];
    if (x == null || y == null || !Number.isFinite(x) || !Number.isFinite(y)) continue;
    xs.push(x);
    ys.push(y);
  }
  return { xs, ys };
}

export interface MatrixCell {
  left: string;
  right: string;
  result: CorrelationResult | null;
}

export function correlationMatrix(rows: readonly Record<string, number | null>[], fields: readonly string[]): MatrixCell[] {
  const cells: MatrixCell[] = [];
  for (const left of fields) {
    for (const right of fields) {
      if (left === right) {
        cells.push({
          left,
          right,
          result: rows.some((row) => row[left] != null) ? { r: 1, n: rows.filter((row) => row[left] != null).length, t: null, df: null, p: null } : null,
        });
        continue;
      }
      const pairs = pairwiseComplete(rows, left, right);
      cells.push({ left, right, result: correlatePair(pairs.xs, pairs.ys) });
    }
  }
  return cells;
}

/** Average-linkage order of indicators using distance 1 − r between correlation profiles. */
export function clusterOrder<T extends string>(fields: readonly T[], cells: readonly MatrixCell[]): T[] {
  if (fields.length <= 2) return [...fields];
  const lookup = new Map(cells.map((cell) => [`${cell.left}|${cell.right}`, cell.result?.r ?? 0]));
  const profile = (field: string) => fields.map((other) => lookup.get(`${field}|${other}`) ?? 0);
  const distance = (left: string[], right: string[]) => {
    let total = 0;
    let count = 0;
    for (const a of left) {
      for (const b of right) {
        const pa = profile(a);
        const pb = profile(b);
        let dot = 0;
        let normA = 0;
        let normB = 0;
        for (let index = 0; index < pa.length; index += 1) {
          const av = pa[index] ?? 0;
          const bv = pb[index] ?? 0;
          dot += av * bv;
          normA += av * av;
          normB += bv * bv;
        }
        const similarity = normA === 0 || normB === 0 ? 0 : dot / Math.sqrt(normA * normB);
        total += 1 - similarity;
        count += 1;
      }
    }
    return count === 0 ? 1 : total / count;
  };

  let clusters = fields.map((field) => [field]);
  while (clusters.length > 1) {
    let bestI = 0;
    let bestJ = 1;
    let best = Number.POSITIVE_INFINITY;
    for (let i = 0; i < clusters.length; i += 1) {
      for (let j = i + 1; j < clusters.length; j += 1) {
        const left = clusters[i];
        const right = clusters[j];
        if (!left || !right) continue;
        const value = distance(left, right);
        if (value < best) {
          best = value;
          bestI = i;
          bestJ = j;
        }
      }
    }
    const merged = [...(clusters[bestI] ?? []), ...(clusters[bestJ] ?? [])];
    clusters = clusters.filter((_, index) => index !== bestI && index !== bestJ);
    clusters.push(merged);
  }
  return clusters[0] ?? [...fields];
}
