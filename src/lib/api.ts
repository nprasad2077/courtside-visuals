import { keepPreviousData, useQueries, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

export type Conf = "E" | "W";
export interface Team {
  abbr: string;
  name: string;
  conf: Conf;
  color: string;
}
export interface Meta {
  seasons: [number, number];
  shotSeasons: [number, number];
  teams: Team[];
}
/** A run of consecutive games for one team; a trade starts a new stint. */
export interface Stint {
  team: string;
  color: string;
  from: number;
  to: number;
  gp: number;
}
export interface Player {
  id: string;
  name: string;
  /** Primary team (most games), not the latest. */
  team: string;
  color: string;
  firstSeason: number;
  lastSeason: number;
  stints: Stint[];
}
export interface Shot {
  x: number;
  y: number;
  made: boolean;
  zone: string;
  three: boolean;
  dist: number;
  q: number;
  secs: number;
  margin: number;
  clutch: boolean;
}
export interface GameRow {
  game_id: string;
  game_date: string;
  team: string;
  opponent: string;
  game_result: "W" | "L";
  team_location: "HOME" | "AWAY";
  minutes_played: number;
  points: number;
  total_rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  plus_minus: number;
  box_plus_minus: number;
  field_goals_made: number;
  field_goals_attempted: number;
  three_pointers_made: number;
  three_pointers_attempted: number;
  true_shooting_pct: number | null;
  effective_fg_pct: number | null;
  usage_pct: number | null;
  offensive_rating: number | null;
  defensive_rating: number | null;
  usage_tier: string | null;
  impact_tier: string | null;
  shooting_efficiency_tier: string | null;
  minutes_based_role: string | null;
  is_double_double: boolean;
  is_triple_double: boolean;
  is_versatile: boolean;
  is_defensive_specialist: boolean;
  is_three_and_d: boolean;
  home_points: number;
  visitor_points: number;
}
export interface PlayerSeason {
  player_id: string;
  player_name: string;
  season: number;
  team: string;
  color?: string;
  gp: number;
  mpg: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  pm: number;
  tot_pts: number;
  tot_reb: number;
  tot_ast: number;
  ts: number;
  efg: number;
  tp_pct: number | null;
  usg: number;
  ortg: number;
  drtg: number;
  bpm: number;
  fga: number;
  tpa: number;
  net: number;
}
export interface Career {
  id: string;
  name: string;
  team: string;
  seasons: PlayerSeason[];
}
export interface RotationPlayer {
  id: string;
  name: string;
  team: string;
  color: string;
  mpg: number;
  usg: number;
  ts: number;
  bpm: number;
  gp: number;
  pts: number;
}
export interface TeamSeason {
  abbr: string;
  name: string;
  conf: Conf;
  color: string;
  seed: number;
  w: number;
  l: number;
  gp: number;
  net: number;
  ortg: number;
  drtg: number;
  pace: number;
  efg: number;
  tov: number;
  orb: number;
  ftr: number;
  last10: number;
  last10Games: number;
  streak: string;
  offensive_tier: string;
  defensive_tier: string;
  shot_selection_style: string;
  ball_movement_style: string;
  ball_security_tier: string;
}
export interface RaceLine {
  team: string;
  color: string;
  series: number[];
}
export interface H2HGame {
  date: string;
  home: boolean;
  aPts: number;
  bPts: number;
  winner: string;
  game_no: number;
}
export interface LeagueSeason {
  season: number;
  pace: number;
  ortg: number;
  efg: number;
  tov: number;
  orb: number;
  ftr: number;
  three_rate: number;
}

type Params = Record<string, string | number | undefined>;

async function get<T>(path: string, params: Params = {}): Promise<T> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined) qs.set(k, String(v));
  const res = await fetch(qs.size ? `${path}?${qs}` : path);
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json() as Promise<T>;
}

/** Keep the last result on screen while the next key loads, so charts animate instead of blanking. */
const keep = { placeholderData: keepPreviousData, staleTime: Infinity } as const;

export const useMeta = () => useQuery({ queryKey: ["meta"], queryFn: () => get<Meta>("/api/meta"), staleTime: Infinity });

export const usePlayerSearch = (q: string, excludeIds: string[] = [], enabled = true) =>
  useQuery({
    queryKey: ["search", q, excludeIds.join(",")],
    queryFn: () => get<Player[]>("/api/players/search", { q, limit: 8, excludeIds: excludeIds.join(",") || undefined }),
    enabled,
    ...keep,
  });

export const usePlayersWithShots = () =>
  useQuery({ queryKey: ["with-shots"], queryFn: () => get<Player[]>("/api/players/with-shots"), staleTime: Infinity });

export const useTopPlayers = (limit: number) =>
  useQuery({ queryKey: ["top", limit], queryFn: () => get<string[]>("/api/players/top", { limit }), staleTime: Infinity });

export const usePlayerSeasons = (id: string | undefined, shots = false) =>
  useQuery({
    queryKey: ["seasons", id, shots],
    queryFn: () => get<number[]>(`/api/players/${id}/seasons`, { shots: shots ? 1 : undefined }),
    enabled: !!id,
    staleTime: Infinity,
  });

const bySeason = <T>(key: string, path: (id: string) => string) => (id: string | undefined, season: number | undefined) =>
  useQuery({
    queryKey: [key, id, season],
    queryFn: () => get<T>(path(id!), { season }),
    enabled: !!id && season != null,
    ...keep,
  });

export const useShots = bySeason<Shot[]>("shots", (id) => `/api/players/${id}/shots`);
export const useGameLog = bySeason<GameRow[]>("gamelog", (id) => `/api/players/${id}/gamelog`);
export const usePlayerSeason = bySeason<PlayerSeason>("player-season", (id) => `/api/players/${id}/season`);

export const useCareer = (id: string) =>
  useQuery({ queryKey: ["career", id], queryFn: () => get<Career>(`/api/players/${id}/career`), staleTime: Infinity });

/** One query per id; the list can grow and shrink without breaking the rules of hooks. */
export const useCareers = (ids: string[]) =>
  useQueries({
    queries: ids.map((id) => ({ queryKey: ["career", id], queryFn: () => get<Career>(`/api/players/${id}/career`), staleTime: Infinity })),
  });

export const useLeagueZones = (season: number | undefined) =>
  useQuery({
    queryKey: ["zones", season],
    queryFn: () => get<Record<string, number>>("/api/league/zones", { season }),
    enabled: season != null,
    ...keep,
  });

/** Defaults pull every player with a game; 1c filters by games and minutes on the client. */
export const useRotation = (season: number, minGp = 1, minMpg = 0) =>
  useQuery({
    queryKey: ["rotation", season, minGp, minMpg],
    queryFn: () => get<RotationPlayer[]>("/api/league/rotation", { season, minGp, minMpg }),
    ...keep,
  });

export const useLeagueHistory = () =>
  useQuery({ queryKey: ["history"], queryFn: () => get<LeagueSeason[]>("/api/league/history"), staleTime: Infinity });

export const useTeamSeason = (season: number) =>
  useQuery({ queryKey: ["team-season", season], queryFn: () => get<TeamSeason[]>("/api/teams/season", { season }), ...keep });

export const useRace = (season: number, conf: Conf) =>
  useQuery({ queryKey: ["race", season, conf], queryFn: () => get<RaceLine[]>("/api/teams/race", { season, conf }), ...keep });

export const useH2H = (a: string, b: string, season: number) =>
  useQuery({ queryKey: ["h2h", a, b, season], queryFn: () => get<H2HGame[]>("/api/teams/h2h", { a, b, season }), ...keep });

/**
 * Season state bound to a player's seasons. When a newly picked player didn't play the
 * current season, snap to their latest. Ignores placeholder data, which still belongs
 * to the previous player.
 */
export function useSeasonFor(id: string | undefined, opts: { shots?: boolean; initial?: number } = {}) {
  const q = usePlayerSeasons(id, opts.shots);
  const [season, setSeason] = useState<number | undefined>(opts.initial);
  const seasons = q.data ?? [];
  useEffect(() => {
    if (!q.data?.length || q.isPlaceholderData) return;
    if (season == null || !q.data.includes(season)) setSeason(q.data[q.data.length - 1]);
  }, [q.data, q.isPlaceholderData, season]);
  return { season, setSeason, seasons };
}
