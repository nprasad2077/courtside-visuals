import { beforeAll, describe, expect, it } from "vitest";
import { CACHE_TABLES, initDb, query, Q, startup } from "./db.ts";

describe("duckdb cache (smoke)", () => {
  beforeAll(async () => {
    await initDb(process.env.DUCKDB_PATH ?? "./data/dbt_nba.duckdb");
  });

  it("builds every cache table with rows", async () => {
    for (const t of CACHE_TABLES) {
      const [r] = await query<{ n: number }>(`SELECT COUNT(*)::INTEGER AS n FROM ${t}`);
      expect(r.n, t).toBeGreaterThan(0);
    }
    expect(startup.ms).toBeGreaterThan(0);
  });

  it("refuses writes to the attached file", async () => {
    await expect(query("CREATE TABLE nba.main.scratch AS SELECT 1")).rejects.toThrow();
  });

  it("caps full regular seasons at 82 games per team", async () => {
    const rows = await query<{ gp: number }>(
      "SELECT MAX(len(results))::INTEGER AS gp FROM team_season WHERE season = 2015",
    );
    expect(rows[0].gp).toBe(82);
  });

  it("ranks prefix matches first in search", async () => {
    const rows = await query<{ name: string }>(Q.player_search, ["curr", "", 8]);
    expect(rows[0].name).toBe("Stephen Curry");
  });
});
