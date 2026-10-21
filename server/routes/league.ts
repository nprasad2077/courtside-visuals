import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { query, Q } from "../db.ts";
import { teamInfo } from "../teams.ts";
import { parse, season, seasonQuery } from "./params.ts";

const rotationQuery = z.object({
  season,
  minGp: z.coerce.number().int().min(1).max(82).default(20),
  minMpg: z.coerce.number().min(0).max(48).default(12),
});

export async function leagueRoutes(app: FastifyInstance) {
  app.get("/api/league/zones", async (req, reply) => {
    const q = parse(seasonQuery, req.query, reply);
    if (!q) return;
    const rows = await query<{ zone: string; fg: number }>(Q.league_zones, [q.season]);
    return Object.fromEntries(rows.map((r) => [r.zone, r.fg]));
  });

  app.get("/api/league/rotation", async (req, reply) => {
    const q = parse(rotationQuery, req.query, reply);
    if (!q) return;
    const rows = await query<{ team: string }>(Q.league_rotation, [q.season, q.minGp, q.minMpg]);
    return rows.map((r) => ({ ...r, color: teamInfo(r.team, q.season).color }));
  });

  app.get("/api/league/history", async () => query(Q.league_history));
}
