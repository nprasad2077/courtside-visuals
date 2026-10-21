import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { query, Q } from "../db.ts";
import { teamInfo } from "../teams.ts";
import { idParams, parse, playerId, seasonQuery } from "./params.ts";

interface Stint {
  team: string;
  from: number;
  to: number;
  gp: number;
}
interface PlayerRow {
  id: string;
  name: string;
  /** Primary team: most games played, not the latest. */
  team: string;
  teamSeason: number;
  firstSeason: number;
  lastSeason: number;
  stints: Stint[];
}
const withColor = ({ teamSeason, ...p }: PlayerRow) => ({
  ...p,
  color: teamInfo(p.team, teamSeason).color,
  stints: p.stints.map((s) => ({ ...s, color: teamInfo(s.team, s.to).color })),
});

const searchQuery = z.object({
  q: z.string().max(64).default(""),
  limit: z.coerce.number().int().min(1).max(25).default(8),
  excludeIds: z
    .string()
    .max(400)
    .default("")
    .transform((s) => s.split(",").filter(Boolean))
    .pipe(z.array(playerId).max(20)),
});

const seasonsQuery = z.object({ shots: z.enum(["0", "1"]).default("0") });

export async function playerRoutes(app: FastifyInstance) {
  app.get("/api/players/search", async (req, reply) => {
    const p = parse(searchQuery, req.query, reply);
    if (!p) return;
    const rows = await query<PlayerRow>(Q.player_search, [p.q, p.excludeIds.join(","), p.limit]);
    return rows.map(withColor);
  });

  app.get("/api/players/with-shots", async () => (await query<PlayerRow>(Q.players_with_shots)).map(withColor));

  // Default picks for career arcs: the top players by career points.
  app.get("/api/players/top", async (req, reply) => {
    const p = parse(z.object({ limit: z.coerce.number().int().min(1).max(10).default(4) }), req.query, reply);
    if (!p) return;
    return (await query<{ id: string }>(Q.top_career, [p.limit])).map((r) => r.id);
  });

  app.get("/api/players/:id/seasons", async (req, reply) => {
    const prm = parse(idParams, req.params, reply);
    const q = prm && parse(seasonsQuery, req.query, reply);
    if (!prm || !q) return;
    const rows = await query<{ season: number }>(q.shots === "1" ? Q.player_shot_seasons : Q.player_seasons, [prm.id]);
    return rows.map((r) => r.season);
  });

  app.get("/api/players/:id/shots", async (req, reply) => {
    const prm = parse(idParams, req.params, reply);
    const q = prm && parse(seasonQuery, req.query, reply);
    if (!prm || !q) return;
    return query(Q.player_shots, [prm.id, q.season]);
  });

  app.get("/api/players/:id/gamelog", async (req, reply) => {
    const prm = parse(idParams, req.params, reply);
    const q = prm && parse(seasonQuery, req.query, reply);
    if (!prm || !q) return;
    return query(Q.player_gamelog, [prm.id, q.season]);
  });

  app.get("/api/players/:id/season", async (req, reply) => {
    const prm = parse(idParams, req.params, reply);
    const q = prm && parse(seasonQuery, req.query, reply);
    if (!prm || !q) return;
    const [row] = await query<Record<string, unknown> & { team: string }>(Q.player_season, [prm.id, q.season]);
    if (!row) return reply.code(404).send({ error: "not_found" });
    return { ...row, color: teamInfo(row.team, q.season).color };
  });

  app.get("/api/players/:id/career", async (req, reply) => {
    const prm = parse(idParams, req.params, reply);
    if (!prm) return;
    const [info] = await query<{ name: string; team: string }>(Q.player_name, [prm.id]);
    if (!info) return reply.code(404).send({ error: "not_found" });
    const seasons = await query(Q.player_career, [prm.id]);
    return { id: prm.id, name: info.name, team: info.team, seasons };
  });
}
