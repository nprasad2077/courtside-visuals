import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DuckDBInstance,
  DuckDBConnection,
  DuckDBPreparedStatement,
  type DuckDBValue,
} from "@duckdb/node-api";

const SQL_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "sql");
const POOL_SIZE = 4;

export function loadSql(name: string): string {
  return readFileSync(resolve(SQL_DIR, `${name}.sql`), "utf8");
}

/** Split a .sql file into statements (no semicolons inside our string literals). */
function statements(sql: string): string[] {
  return sql
    .replace(/--.*$/gm, "")
    .split(/;\s*(?:\n|$)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

type Row = Record<string, unknown>;

/** DuckDB JS values → plain JSON-friendly values (bigint/decimal → number, dates → ISO date). */
export function toPlain(v: unknown): unknown {
  if (v == null) return null;
  if (typeof v === "bigint") return Number(v);
  if (Array.isArray(v)) return v.map(toPlain);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    const o: Row = {};
    for (const [k, x] of Object.entries(v as Row)) o[k] = toPlain(x);
    return o;
  }
  return v;
}

interface PooledConn {
  con: DuckDBConnection;
  stmts: Map<string, DuckDBPreparedStatement>;
  busy: Promise<unknown>;
}

let pool: PooledConn[] = [];
let next = 0;
export const startup = { ms: 0, path: "" };

export async function initDb(path = process.env.DUCKDB_PATH ?? "./data/dbt_nba.duckdb") {
  const t0 = performance.now();
  const abs = resolve(path);
  const instance = await DuckDBInstance.create(":memory:");
  const main = await instance.connect();
  // Values here come from server config, never from a request.
  await main.run(`ATTACH '${abs.replace(/'/g, "''")}' AS nba (READ_ONLY)`);
  for (const s of [...statements(loadSql("season_bounds")), ...statements(loadSql("cache"))]) {
    await main.run(s);
  }
  // The cache tables live in the in-memory catalog, so every pooled connection can see them.
  pool = [{ con: main, stmts: new Map(), busy: Promise.resolve() }];
  for (let i = 1; i < POOL_SIZE; i++) {
    pool.push({ con: await instance.connect(), stmts: new Map(), busy: Promise.resolve() });
  }
  startup.ms = Math.round(performance.now() - t0);
  startup.path = abs;
}

/**
 * Run a parameterized query on the next pooled connection. Statements are prepared
 * once per connection and re-bound per call; calls on one connection are serialized
 * so a bind can't interleave with another request's run.
 */
export function query<T = Row>(sql: string, params: DuckDBValue[] = []): Promise<T[]> {
  if (!pool.length) throw new Error("DB not initialised");
  const pc = pool[next++ % pool.length];
  const job = pc.busy.then(async () => {
    let st = pc.stmts.get(sql);
    if (!st) {
      st = await pc.con.prepare(sql);
      pc.stmts.set(sql, st);
    }
    st.clearBindings();
    if (params.length) st.bind(params);
    const reader = await st.runAndReadAll();
    return reader.getRowObjectsJS().map((r) => toPlain(r) as T);
  });
  pc.busy = job.catch(() => undefined);
  return job;
}

export const CACHE_TABLES = [
  "season_bounds",
  "player_game",
  "player_season",
  "player_index",
  "shot",
  "team_game",
  "team_season",
  "league_season",
  "league_zone",
] as const;

/** Named request queries from sql/queries.sql (`-- name: x` blocks). */
export const Q: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  for (const block of loadSql("queries").split(/^-- name: /m).slice(1)) {
    const nl = block.indexOf("\n");
    const name = block.slice(0, nl).trim();
    out[name] = block.slice(nl + 1).replace(/--.*$/gm, "").trim().replace(/;$/, "");
  }
  return out;
})();
