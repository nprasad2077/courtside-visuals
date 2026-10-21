import { Fragment, useState } from "react";
import { Card } from "../components/Card";
import { PlayerSearch } from "../components/PlayerSearch";
import { usePlayerSeason, useSeasonFor, type PlayerSeason } from "../lib/api";
import { num, pct, seasonLabel, signed } from "../lib/format";
import { useTransition } from "../lib/motion";

type Key = "pts" | "reb" | "ast" | "stl" | "blk" | "tov" | "ts" | "efg" | "tp_pct" | "usg" | "ortg" | "drtg" | "bpm" | "net";
interface Row {
  key: Key;
  label: string;
  lo: number;
  hi: number;
  lowerBetter?: boolean;
  fmt: (v: number) => string;
}

const per = (v: number) => num(v);
const GROUPS: Row[][] = [
  [
    { key: "pts", label: "PTS", lo: 0, hi: 36, fmt: per },
    { key: "reb", label: "REB", lo: 0, hi: 15, fmt: per },
    { key: "ast", label: "AST", lo: 0, hi: 12, fmt: per },
    { key: "stl", label: "STL", lo: 0, hi: 2.4, fmt: per },
    { key: "blk", label: "BLK", lo: 0, hi: 4, fmt: per },
    { key: "tov", label: "TOV", lo: 0, hi: 5, fmt: per, lowerBetter: true },
  ],
  [
    { key: "ts", label: "TS%", lo: 0.45, hi: 0.7, fmt: (v) => pct(v) },
    { key: "efg", label: "eFG%", lo: 0.4, hi: 0.65, fmt: (v) => pct(v) },
    { key: "tp_pct", label: "3P%", lo: 0.25, hi: 0.46, fmt: (v) => pct(v) },
    { key: "usg", label: "USG%", lo: 10, hi: 40, fmt: per },
  ],
  [
    { key: "ortg", label: "ORtg", lo: 95, hi: 130, fmt: per },
    { key: "drtg", label: "DRtg", lo: 100, hi: 125, fmt: per, lowerBetter: true },
    { key: "bpm", label: "BPM", lo: -4, hi: 12, fmt: (v) => signed(v) },
    { key: "net", label: "Net", lo: -10, hi: 15, fmt: (v) => signed(v) },
  ],
];
const ROWS = GROUPS.flat();

const width = (v: number | null, r: Row) => (v == null ? 0 : Math.min(100, Math.max(4, ((v - r.lo) / (r.hi - r.lo)) * 100)));

/** -1: A wins, 1: B wins, 0: tie or missing. */
function winner(a: PlayerSeason | undefined, b: PlayerSeason | undefined, r: Row): -1 | 0 | 1 {
  const va = a?.[r.key];
  const vb = b?.[r.key];
  if (va == null || vb == null || va === vb) return 0;
  return (va > vb) !== !!r.lowerBetter ? -1 : 1;
}

function useSide(initial: { id: string; name: string }, initialSeason: number) {
  const [player, setPlayer] = useState(initial);
  const s = useSeasonFor(player.id, { initial: initialSeason });
  const q = usePlayerSeason(player.id, s.season);
  return { player, setPlayer, ...s, data: q.data };
}

function SideHead({ side, align }: { side: ReturnType<typeof useSide>; align: "left" | "right" }) {
  const d = side.data;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: align === "right" ? "flex-end" : "flex-start", minWidth: 0 }}>
      <PlayerSearch
        value={side.player}
        season={side.season}
        onSelect={(p, s) => {
          side.setPlayer({ id: p.id, name: p.name });
          if (s != null) side.setSeason(s);
        }}
        align={align}
        width={210}
      />
      <select
        className="pill-select"
        aria-label={`Season for ${side.player.name}`}
        value={side.season ?? ""}
        onChange={(e) => side.setSeason(Number(e.target.value))}
      >
        {[...side.seasons].reverse().map((s) => (
          <option key={s} value={s}>
            {seasonLabel(s)}
          </option>
        ))}
      </select>
      <span className="row num" style={{ gap: 6, fontSize: 11.5, color: "#645c50" }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: d?.color ?? "#c0b6a5" }} />
        {d ? `${d.team} · ${d.gp} GP · ${num(d.mpg)} MPG` : "—"}
      </span>
    </div>
  );
}

export function PlayerVsPlayerCard() {
  const a = useSide({ id: "jamesle01", name: "LeBron James" }, 2012);
  const b = useSide({ id: "duranke01", name: "Kevin Durant" }, 2013);
  const tr = useTransition();

  const results = ROWS.map((r) => winner(a.data, b.data, r));
  const winsA = results.filter((w) => w === -1).length;
  const winsB = results.filter((w) => w === 1).length;
  const colorA = a.data?.color ?? "#c67139";
  const colorB = b.data?.color && b.data.color.toLowerCase() !== colorA.toLowerCase() ? b.data.color : "#7a8a5e";

  const bar = (v: number | null, r: Row, side: "a" | "b", won: boolean) => (
    <div style={{ display: "flex", justifyContent: side === "a" ? "flex-end" : "flex-start", minWidth: 0 }}>
      <div
        style={{
          height: 14,
          width: `${width(v, r)}%`,
          background: won ? (side === "a" ? colorA : colorB) : "#dcd3c4",
          borderRadius: side === "a" ? "999px 4px 4px 999px" : "4px 999px 999px 4px",
          transition: tr("width, background", 0.55),
        }}
      />
    </div>
  );
  const val = (v: number | null, r: Row, won: boolean, align: "left" | "right") => (
    <span className="num" style={{ fontSize: 12, fontWeight: won ? 800 : 500, textAlign: align, color: won ? "#2e2b25" : "#645c50" }}>
      {v == null ? "—" : r.fmt(v)}
    </span>
  );

  return (
    <Card
      id="1d"
      width={620}
      caption="Two player-seasons side by side, row by row"
      kicker="Player vs player · int_player_performance"
      title="Head to head, season for season"
      sub="Each row goes to the better number. TOV and DRtg: lower wins."
    >
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto minmax(0,1fr)", gap: 12, alignItems: "start" }}>
        <SideHead side={a} align="left" />
        <div style={{ textAlign: "center", paddingTop: 4 }}>
          <div className="num" style={{ fontFamily: "var(--font-heading)", fontSize: 34, lineHeight: 1 }}>
            {winsA}–{winsB}
          </div>
          <div className="tile-label" style={{ marginTop: 4 }}>
            rows won
          </div>
        </div>
        <SideHead side={b} align="right" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "44px minmax(0,1fr) 92px minmax(0,1fr) 44px", rowGap: 8, columnGap: 6, alignItems: "center" }}>
        {GROUPS.map((group, gi) => (
          <Fragment key={gi}>
            {gi > 0 && <div style={{ gridColumn: "1 / -1", borderTop: "1px dashed rgba(32,30,29,.18)", margin: "2px 0" }} />}
            {group.map((r) => {
              const w = winner(a.data, b.data, r);
              const va = (a.data?.[r.key] as number | null | undefined) ?? null;
              const vb = (b.data?.[r.key] as number | null | undefined) ?? null;
              return (
                <Fragment key={r.key}>
                  {val(va, r, w === -1, "left")}
                  {bar(va, r, "a", w === -1)}
                  <span style={{ textAlign: "center", fontSize: 10.5, fontWeight: 700, letterSpacing: ".06em", color: "#474238" }}>
                    {r.label}
                    {r.lowerBetter ? " ★" : ""}
                  </span>
                  {bar(vb, r, "b", w === 1)}
                  {val(vb, r, w === 1, "right")}
                </Fragment>
              );
            })}
          </Fragment>
        ))}
      </div>
      <div className="note">★ lower is better. Bars run on fixed per-row scales, so lengths compare across seasons.</div>
    </Card>
  );
}
