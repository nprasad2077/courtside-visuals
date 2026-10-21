type RGB = [number, number, number];

function rgb(hex: string): RGB {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/./g, "$&$&") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function hex([r, g, b]: RGB): string {
  return "#" + [r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("");
}

/** Linear RGB mix: t = 0 → a, t = 1 → b. */
export function mix(a: string, b: string, t: number): string {
  const k = Math.max(0, Math.min(1, t));
  const A = rgb(a);
  const B = rgb(b);
  return hex([A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k, A[2] + (B[2] - A[2]) * k]);
}

export const COLD = "#56633f";
export const PAR = "#e3d8c6";
export const HOT = "#b2622d";

/** Below par → sage, par → sand, above par → terracotta. delta/span is clamped to [-1, 1]. */
export function diverging(delta: number, span: number): string {
  const t = Math.max(-1, Math.min(1, delta / span));
  return t >= 0 ? mix(PAR, HOT, t) : mix(PAR, COLD, -t);
}

/** Relative luminance, used to pick cream vs ink text on a fill. */
export function isDark(hexColor: string): boolean {
  const [r, g, b] = rgb(hexColor).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.33;
}
