/** Basketball-Reference frame: 500 × 420, 10 px = 1 ft, hoop at (250, 52.5), baseline at the top. */
export const COURT_W = 500;
export const COURT_H = 420;
export const HOOP = { x: 250, y: 52.5 };

export const COURT_PATHS = {
  three: "M30 0 L30 142 A237.5 237.5 0 0 0 470 142 L470 0",
  restricted: "M210 52.5 A40 40 0 0 0 290 52.5",
};

/** The six zones in the order the table lists them; names match int_player_shots_enriched.shot_zone. */
export const ZONES = [
  { key: "At Rim (0-3 ft)", short: "At rim", range: "0–3 ft" },
  { key: "Short Range (4-10 ft)", short: "Short", range: "4–10 ft" },
  { key: "Mid Range (11-16 ft)", short: "Mid-range", range: "11–16 ft" },
  { key: "Long Mid Range (17-23 ft)", short: "Long mid", range: "17–23 ft" },
  { key: "Three Point (24-27 ft)", short: "Three", range: "24–27 ft" },
  { key: "Deep Three (28+ ft)", short: "Deep three", range: "28+ ft" },
] as const;

export interface ZoneHit {
  key: string;
  zi: number;
  corner: boolean;
}

/** Classify a court point into a sub-zone key ("0C", "1L", "4Lc", "5R", …). */
export function zoneKey(x: number, y: number): ZoneHit {
  const dx = x - HOOP.x;
  const dy = y - HOOP.y;
  const d = Math.hypot(dx, dy) / 10;
  const corner = (x < 30 || x > 470) && y < 142;
  const three = corner || (d >= 23.75 && y >= 142);
  const zi = three ? (d >= 28 ? 5 : 4) : d < 4 ? 0 : d < 11 ? 1 : d < 17 ? 2 : 3;
  if (zi === 0) return { key: "0C", zi, corner: false };
  if (corner) return { key: `${zi}${x < 250 ? "Lc" : "Rc"}`, zi, corner };
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  return { key: `${zi}${angle < 55 ? "R" : angle > 125 ? "L" : "C"}`, zi, corner };
}
