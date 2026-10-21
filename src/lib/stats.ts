export function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
}

/** Trailing rolling mean: point i averages values (i-w, i]. Early points use what's available. */
export function rolling(xs: number[], w: number): number[] {
  const out: number[] = [];
  let sum = 0;
  for (let i = 0; i < xs.length; i++) {
    sum += xs[i];
    if (i >= w) sum -= xs[i - w];
    out.push(sum / Math.min(i + 1, w));
  }
  return out;
}

/** Share of the pool strictly below v, scaled so the max is 1 (count below / (n − 1)). */
export function percentile(v: number, pool: number[]): number {
  if (pool.length < 2) return 1;
  return pool.filter((x) => x < v).length / (pool.length - 1);
}

/** Space labels at least `gap` apart while keeping them as near their targets as possible. */
export function spreadLabels(ys: number[], gap: number, lo = -Infinity, hi = Infinity): number[] {
  const order = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y);
  const out = order.map((o) => o.y);
  // Forward pass pushes labels down; backward pass pulls the stack back above `hi`.
  for (let i = 1; i < out.length; i++) out[i] = Math.max(out[i], out[i - 1] + gap);
  for (let i = out.length - 1; i >= 0; i--) {
    out[i] = Math.min(out[i], i === out.length - 1 ? hi : out[i + 1] - gap);
  }
  for (let i = 0; i < out.length; i++) out[i] = Math.max(out[i], lo);
  const res = new Array<number>(ys.length);
  order.forEach((o, k) => (res[o.i] = out[k]));
  return res;
}
