/** Two-tailed Student t probability via the regularized incomplete beta function. */
export function studentTTwoTailedP(t: number, df: number): number {
  if (!Number.isFinite(df) || df <= 0) return Number.NaN;
  if (!Number.isFinite(t)) return 0;
  if (t === 0) return 1;
  const x = df / (df + t * t);
  const probability = regularizedIncompleteBeta(x, df / 2, 0.5);
  return Math.min(1, Math.max(0, probability));
}

function regularizedIncompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const logBeta = logGamma(a) + logGamma(b) - logGamma(a + b);
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - logBeta) / a;
  if (x < (a + 1) / (a + b + 2)) return front * betaContinuedFraction(x, a, b);
  return 1 - (Math.exp(Math.log(1 - x) * b + Math.log(x) * a - logBeta) / b) * betaContinuedFraction(1 - x, b, a);
}

function betaContinuedFraction(x: number, a: number, b: number): number {
  const maxIterations = 200;
  const epsilon = 1e-12;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < 1e-30) d = 1e-30;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= maxIterations; m += 1) {
    const m2 = 2 * m;
    let numerator = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + numerator * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + numerator / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    h *= d * c;
    numerator = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + numerator * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + numerator / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < epsilon) break;
  }
  return h;
}

function logGamma(value: number): number {
  const coefficients = [
    76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.00120865097386618,
    -0.00000539523938495,
  ];
  let x = value;
  let y = value;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let sum = 1.000000000190015;
  for (const coefficient of coefficients) {
    y += 1;
    sum += coefficient / y;
  }
  return -tmp + Math.log((2.506628274631 * sum) / x);
}
