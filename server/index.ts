import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { initDb, query, startup, CACHE_TABLES, Q } from "./db.ts";
import { TEAMS } from "./teams.ts";
import { playerRoutes } from "./routes/players.ts";
import { leagueRoutes } from "./routes/league.ts";
import { teamRoutes } from "./routes/teams.ts";

const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? "info" } });
await app.register(cors, { origin: [/^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/] });

await initDb();
app.log.info({ ms: startup.ms, path: startup.path }, "duckdb cache ready (read-only attach)");

// The data only changes when dbt rebuilds the file.
app.addHook("onSend", async (req, reply, payload) => {
  if (req.url.startsWith("/api/") && reply.statusCode === 200 && !req.url.startsWith("/api/health")) {
    reply.header("Cache-Control", "max-age=3600");
  }
  return payload;
});

app.get("/api/health", async () => {
  const counts: Record<string, number> = {};
  for (const t of CACHE_TABLES) {
    // Table names come from a fixed server-side list, not from the request.
    const [r] = await query<{ n: number }>(`SELECT COUNT(*)::INTEGER AS n FROM ${t}`);
    counts[t] = r.n;
  }
  return { ok: true, readOnly: true, startupMs: startup.ms, tables: counts };
});

app.get("/api/meta", async () => {
  const [seasons] = await query<{ lo: number; hi: number }>(Q.meta_seasons);
  const [shots] = await query<{ lo: number; hi: number }>(Q.meta_shot_seasons);
  return { seasons: [seasons.lo, seasons.hi], shotSeasons: [shots.lo, shots.hi], teams: TEAMS };
});

await app.register(playerRoutes);
await app.register(leagueRoutes);
await app.register(teamRoutes);

const dist = resolve("dist");
if (process.env.NODE_ENV === "production" && existsSync(dist)) {
  await app.register(fastifyStatic, { root: dist });
}

await app.listen({ port: Number(process.env.PORT ?? 8787), host: "127.0.0.1" });
