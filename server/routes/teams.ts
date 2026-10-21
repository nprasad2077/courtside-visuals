import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { query, Q } from "../db.ts";
import { teamInfo, type Conf } from "../teams.ts";
import { assignSeeds, last10, streak } from "../standings.ts";
import { conf, parse, season, seasonQuery, teamCode } from "./params.ts";

interface TeamSeasonRow {
  team: string;
  w: number;
  l: number;
  ortg: number;
  drtg: number;
  net: number;
  pace: number;
  efg: number;
  tov: number;
  orb: number;
  ftr: number;
  offensive_tier: string;
  defensive_tier: string;
  shot_selection_style: string;
  ball_movement_style: string;
  ball_security_tier: string;
  results: string[];
}

export async function teamSeason(s: number) {
  const rows = await query<TeamSeasonRow>(Q.team_season, [s]);
  const out = rows.map(({ results, ...r }) => {
    const info = teamInfo(r.team, s);
    return {
      ...r,
      abbr: r.team,
      name: info.name,
      conf: info.conf as Conf,
      color: info.color,
      gp: results.length,
      last10: last10(results),
      last10Games: Math.min(10, results.length),
      streak: streak(results),
      seed: 0,
    };
  });
  return assignSeeds(out);
}

export async function teamRoutes(app: FastifyInstance) {
  app.get("/api/teams/season", async (req, reply) => {
    const q = parse(seasonQuery, req.query, reply);
    if (!q) return;
    return teamSeason(q.season);
  });

  app.get("/api/teams/race", async (req, reply) => {
    const q = parse(z.object({ season, conf }), req.query, reply);
    if (!q) return;
    const rows = await query<{ team: string; series: number[] }>(Q.team_race, [q.season]);
    return rows
      .filter((r) => teamInfo(r.team, q.season).conf === q.conf)
      .map((r) => ({ team: r.team, color: teamInfo(r.team, q.season).color, series: r.series }));
  });

  app.get("/api/teams/h2h", async (req, reply) => {
    const q = parse(z.object({ a: teamCode, b: teamCode, season }), req.query, reply);
    if (!q) return;
    return query(Q.team_h2h, [q.a, q.b, q.season]);
  });
}
