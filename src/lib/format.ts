const MINUS = "−";

const ok = (v: number | null | undefined): v is number => v != null && Number.isFinite(v);

/** pct(0.6123) → "61.2" (callers add the % sign where shown). */
export function pct(v: number | null | undefined, digits = 1): string {
  return ok(v) ? (v * 100).toFixed(digits) : "—";
}

/** signed(3.24) → "+3.2", signed(-1) → "−1.0" (U+2212). */
export function signed(v: number | null | undefined, digits = 1): string {
  if (!ok(v)) return "—";
  const s = Math.abs(v).toFixed(digits);
  if (Number(s) === 0) return s;
  return (v > 0 ? "+" : MINUS) + s;
}

/** Fixed decimals with a real minus sign. */
export function num(v: number | null | undefined, digits = 1): string {
  if (!ok(v)) return "—";
  const s = Math.abs(v).toFixed(digits);
  return v < 0 && Number(s) !== 0 ? MINUS + s : s;
}

/** Standings percentage: .732 (no leading zero), 1.000 stays. */
export function winPct(w: number, gp: number): string {
  if (!gp) return ".000";
  return (w / gp).toFixed(3).replace(/^0/, "");
}

/** 2016 → "2016–17" (en dash). */
export function seasonLabel(y: number): string {
  return `${y}–${String((y + 1) % 100).padStart(2, "0")}`;
}

/** 2006 → "'06". */
export function shortYear(y: number): string {
  return `'${String(y % 100).padStart(2, "0")}`;
}

/** "2015-12-25" → "Dec 25, 2015" (dates are calendar days, so format in UTC). */
export function dateLabel(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function shortDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function lastName(name: string): string {
  const parts = name.trim().split(/\s+/);
  const suffix = /^(jr\.?|sr\.?|ii|iii|iv)$/i;
  while (parts.length > 1 && suffix.test(parts[parts.length - 1])) parts.pop();
  return parts[parts.length - 1];
}

/** Game clock left in a quarter, from seconds remaining: 252 → "4:12". */
export function clock(secs: number): string {
  const s = Math.max(0, Math.round(secs));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
