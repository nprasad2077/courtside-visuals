// Static franchise metadata. The database has no conference, name or color.
// Codes follow Basketball-Reference (BRK, CHO, PHO). Team colors are identity marks only.

export type Conf = "E" | "W";
export interface Team {
  abbr: string;
  name: string;
  conf: Conf;
  color: string;
}

export const TEAMS: Team[] = [
  { abbr: "ATL", name: "Atlanta Hawks", conf: "E", color: "#C8102E" },
  { abbr: "BOS", name: "Boston Celtics", conf: "E", color: "#007A33" },
  { abbr: "BRK", name: "Brooklyn Nets", conf: "E", color: "#2B2B2B" },
  { abbr: "CHO", name: "Charlotte Hornets", conf: "E", color: "#1D1160" },
  { abbr: "CHI", name: "Chicago Bulls", conf: "E", color: "#CE1141" },
  { abbr: "CLE", name: "Cleveland Cavaliers", conf: "E", color: "#860038" },
  { abbr: "DET", name: "Detroit Pistons", conf: "E", color: "#1D428A" },
  { abbr: "IND", name: "Indiana Pacers", conf: "E", color: "#002D62" },
  { abbr: "MIA", name: "Miami Heat", conf: "E", color: "#98002E" },
  { abbr: "MIL", name: "Milwaukee Bucks", conf: "E", color: "#00471B" },
  { abbr: "NYK", name: "New York Knicks", conf: "E", color: "#F58426" },
  { abbr: "ORL", name: "Orlando Magic", conf: "E", color: "#0077C0" },
  { abbr: "PHI", name: "Philadelphia 76ers", conf: "E", color: "#006BB6" },
  { abbr: "TOR", name: "Toronto Raptors", conf: "E", color: "#CE1141" },
  { abbr: "WAS", name: "Washington Wizards", conf: "E", color: "#002B5C" },
  { abbr: "DAL", name: "Dallas Mavericks", conf: "W", color: "#00538C" },
  { abbr: "DEN", name: "Denver Nuggets", conf: "W", color: "#0E2240" },
  { abbr: "GSW", name: "Golden State Warriors", conf: "W", color: "#1D428A" },
  { abbr: "HOU", name: "Houston Rockets", conf: "W", color: "#CE1141" },
  { abbr: "LAC", name: "Los Angeles Clippers", conf: "W", color: "#C8102E" },
  { abbr: "LAL", name: "Los Angeles Lakers", conf: "W", color: "#552583" },
  { abbr: "MEM", name: "Memphis Grizzlies", conf: "W", color: "#5D76A9" },
  { abbr: "MIN", name: "Minnesota Timberwolves", conf: "W", color: "#0C2340" },
  { abbr: "NOP", name: "New Orleans Pelicans", conf: "W", color: "#0C2340" },
  { abbr: "OKC", name: "Oklahoma City Thunder", conf: "W", color: "#007AC1" },
  { abbr: "PHO", name: "Phoenix Suns", conf: "W", color: "#E56020" },
  { abbr: "POR", name: "Portland Trail Blazers", conf: "W", color: "#E03A3E" },
  { abbr: "SAC", name: "Sacramento Kings", conf: "W", color: "#5A2D81" },
  { abbr: "SAS", name: "San Antonio Spurs", conf: "W", color: "#6B6F73" },
  { abbr: "UTA", name: "Utah Jazz", conf: "W", color: "#002B5C" },
];

// Historical / alternate codes → current franchise key. The original code stays in the data.
export const ALIASES: Record<string, string> = {
  BKN: "BRK",
  NJN: "BRK",
  SEA: "OKC",
  NOH: "NOP",
  NOK: "NOP",
  CHA: "CHO",
  CHH: "CHO",
  VAN: "MEM",
  PHX: "PHO",
  WSB: "WAS",
};

// Historical display names for codes that differ from the current franchise.
const HISTORICAL_NAMES: Record<string, string> = {
  NJN: "New Jersey Nets",
  SEA: "Seattle SuperSonics",
  NOH: "New Orleans Hornets",
  NOK: "New Orleans/Oklahoma City Hornets",
  CHA: "Charlotte Bobcats",
  CHH: "Charlotte Hornets",
  VAN: "Vancouver Grizzlies",
};

const BY_ABBR = new Map(TEAMS.map((t) => [t.abbr, t]));

export function franchiseOf(code: string): string {
  return ALIASES[code] ?? code;
}

/** Metadata for a code as it appeared in a given season. */
export function teamInfo(code: string, season?: number): Team {
  const base = BY_ABBR.get(franchiseOf(code));
  if (!base) return { abbr: code, name: code, conf: "E", color: "#a19786" };
  let conf = base.conf;
  // The New Orleans Hornets played in the East until the 2004 realignment.
  if ((code === "NOH" || code === "CHH") && season != null && season <= 2003) conf = "E";
  return { abbr: code, name: HISTORICAL_NAMES[code] ?? base.name, conf, color: base.color };
}
