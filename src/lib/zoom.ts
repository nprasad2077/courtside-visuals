export type Domain = [number, number];

const span = (d: Domain) => d[1] - d[0];

/** Keep `d` inside `bounds`, shifting rather than shrinking it when it fits. */
export function clampDomain(d: Domain, bounds: Domain): Domain {
  const w = Math.min(span(d), span(bounds));
  const lo = Math.min(Math.max(d[0], bounds[0]), bounds[1] - w);
  return [lo, lo + w];
}

/**
 * Scale a domain by `factor` (<1 zooms in) around `at`, so the value under the cursor stays put.
 * `minSpan` stops zooming in past a useful level; zooming out stops at `bounds`.
 */
export function zoomAround(d: Domain, at: number, factor: number, bounds: Domain, minSpan: number): Domain {
  const w = Math.min(span(bounds), Math.max(minSpan, span(d) * factor));
  const t = span(d) ? (at - d[0]) / span(d) : 0.5;
  return clampDomain([at - t * w, at - t * w + w], bounds);
}

export function panBy(d: Domain, delta: number, bounds: Domain): Domain {
  return clampDomain([d[0] + delta, d[1] + delta], bounds);
}

/** Index of the point nearest (px, py) within `maxDist`, or -1. Linear scan; a season is ~500 points. */
export function nearest(points: { x: number; y: number }[], px: number, py: number, maxDist: number): number {
  let best = -1;
  let bestD = maxDist * maxDist;
  for (let i = 0; i < points.length; i++) {
    const dx = points[i].x - px;
    const dy = points[i].y - py;
    const d = dx * dx + dy * dy;
    if (d <= bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/** Value at quantile q (0–1) of an unsorted list, linear interpolation. */
export function quantile(xs: number[], q: number): number {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const i = (s.length - 1) * q;
  const lo = Math.floor(i);
  return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (i - lo);
}
