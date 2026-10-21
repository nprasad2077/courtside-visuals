import type { Conf } from "./teams.ts";

/** Wins in the last 10 results (results are in game order). */
export function last10(results: string[]): number {
  return results.slice(-10).filter((r) => r === "W").length;
}

/** Current streak as "W4" / "L2" ("—" with no games). */
export function streak(results: string[]): string {
  if (!results.length) return "—";
  const last = results[results.length - 1];
  let n = 0;
  for (let i = results.length - 1; i >= 0 && results[i] === last; i--) n++;
  return last + n;
}

/** Seed within each conference: wins desc, then net rating desc. Mutates and returns rows. */
export function assignSeeds<T extends { conf: Conf; w: number; net: number; seed?: number }>(rows: T[]): T[] {
  for (const conf of ["E", "W"] as const) {
    rows
      .filter((r) => r.conf === conf)
      .sort((a, b) => b.w - a.w || b.net - a.net)
      .forEach((r, i) => (r.seed = i + 1));
  }
  return rows;
}
