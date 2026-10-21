import { scaleBand, scaleLinear } from "d3-scale";
import { line } from "d3-shape";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { Card } from "../components/Card";
import { Tip, useChartTooltip } from "../components/ChartTooltip";
import { MorphPath } from "../components/MorphPath";
import { PlayerSearch } from "../components/PlayerSearch";
import { Lab, Plot } from "../components/Plot";
import { SeasonSlider } from "../components/SeasonSlider";
import { Segmented } from "../components/Segmented";
import { StatTile } from "../components/StatTile";
import { useGameLog, useSeasonFor, type GameRow } from "../lib/api";
import { num, pct, signed } from "../lib/format";
import { EASE, useDuration } from "../lib/motion";
import { mean, rolling } from "../lib/stats";

type StatKey = "pts" | "reb" | "ast" | "ts" | "usg" | "pm";
const STATS: { value: StatKey; label: string; get: (g: GameRow) => number | null; fmt: (v: number) => string }[] = [
  { value: "pts", label: "PTS", get: (g) => g.points, fmt: (v) => num(v) },
  { value: "reb", label: "REB", get: (g) => g.total_rebounds, fmt: (v) => num(v) },
  { value: "ast", label: "AST", get: (g) => g.assists, fmt: (v) => num(v) },
  { value: "ts", label: "TS%", get: (g) => g.true_shooting_pct, fmt: (v) => pct(v) },
  { value: "usg", label: "USG%", get: (g) => g.usage_pct, fmt: (v) => num(v) },
  { value: "pm", label: "+/−", get: (g) => g.plus_minus, fmt: (v) => signed(v) },
];

const W = 660;
const H = 236;
const L = 34;
const R = 8;
const T = 10;
const B = 206;
const RIBBON = 214;

const DEFAULT = { id: "jokicni01", name: "Nikola Jokić" };

export function GameTrendCard() {
  const [player, setPlayer] = useState(DEFAULT);
  const { season, setSeason, seasons } = useSeasonFor(player.id, { initial: 2023 });
  const { data } = useGameLog(player.id, season);
  const games = useMemo(() => data ?? [], [data]);
  const [stat, setStat] = useState<StatKey>("pts");
  const tip = useChartTooltip();
  const dur = useDuration();

  const def = STATS.find((s) => s.value === stat)!;
  const diverge = stat === "pm";
  const vals = games.map((g) => def.get(g));
  const present = vals.filter((v): v is number => v != null);
  const avg = mean(present);
  const roll = rolling(vals.map((v) => v ?? avg), 10);
  const n = games.length;

  const x = scaleBand<number>()
    .domain(games.map((_, i) => i))
    .range([L, W - R])
    .paddingInner(0.18);
  const hi = Math.max(...present.map(Math.abs), 1);
  const y = diverge
    ? scaleLinear().domain([-hi, hi]).range([B, T]).nice()
    : scaleLinear()
        .domain([stat === "ts" ? Math.min(0.2, ...present) : 0, Math.max(...present, stat === "ts" ? 1 : 1)])
        .range([B, T])
        .nice();
  const base = y(diverge ? 0 : y.domain()[0]);

  const rollPath =
    line<number>()
      .x((_, i) => (x(i) ?? 0) + x.bandwidth() / 2)
      .y((v) => y(v))(roll) ?? "";

  const last10 = mean(present.slice(-10));
  const highIdx = vals.reduce<number>((b, v, i) => (v != null && (b < 0 || v > (vals[b] ?? -Infinity)) ? i : b), -1);
  const above = present.filter((v) => v >= avg).length;

  return (
    <Card
      id="1g"
      width={720}
      caption="Game-by-game production through a season, with a 10-game rolling average"
      kicker="Game trend · int_player_performance"
      title={`${player.name}, game by game`}
      sub={`${n} games · bars above the season average are terracotta · green line is the trailing 10-game average`}
      controls={
        <>
          <PlayerSearch
            value={player}
            season={season}
            onSelect={(p, s) => {
              setPlayer({ id: p.id, name: p.name });
              if (s != null) setSeason(s);
            }}
          />
          <SeasonSlider value={season} onChange={setSeason} seasons={seasons} />
        </>
      }
    >
      <Segmented options={STATS} value={stat} onChange={setStat} label="Stat" />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
        <StatTile label="Season avg" value={present.length ? def.fmt(avg) : "—"} sub={`${present.length} games`} />
        <StatTile
          label="Last 10"
          value={present.length ? def.fmt(last10) : "—"}
          sub={
            <b style={{ color: last10 - avg >= 0 ? "#8c491a" : "#56633f" }}>
              {signed((last10 - avg) * (stat === "ts" ? 100 : 1))} vs avg
            </b>
          }
        />
        <StatTile
          label="Season high"
          value={highIdx >= 0 ? def.fmt(vals[highIdx]!) : "—"}
          sub={highIdx >= 0 ? `G${highIdx + 1} vs ${games[highIdx].opponent}` : ""}
        />
        <StatTile
          label="Above avg"
          value={`${above}/${present.length}`}
          sub={present.length ? `${Math.round((above / present.length) * 100)}% of games` : ""}
        />
      </div>

      <Plot
        w={W}
        h={H}
        svgProps={{ "aria-label": `${def.label} by game` }}
        labels={
          <>
            {y.ticks(4).map((t) => (
              <Lab key={t} x={L - 6} y={y(t)} w={W} h={H} ax="end" className="tick">
                {stat === "ts" ? pct(t, 0) : diverge ? signed(t, 0) : t}
              </Lab>
            ))}
            {n > 0 && (
              <Lab x={W - R} y={y(avg) - 4} w={W} h={H} ax="end" ay="bottom" halo className="tick" style={{ color: "#474238" }}>
                avg {def.fmt(avg)}
              </Lab>
            )}
          </>
        }
      >
        {y.ticks(4).map((t) => (
          <line key={t} x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke={t === 0 && diverge ? "#a19786" : "rgba(32,30,29,.07)"} />
        ))}
        {games.map((g, i) => {
          const v = vals[i];
          const top = v == null ? base : Math.min(y(v), base);
          const h = v == null ? 0 : Math.abs(y(v) - base);
          const fill = v != null && v >= avg ? "#d67f48" : "#dcd3c4";
          return (
            <motion.rect
              key={i}
              x={x(i)}
              width={x.bandwidth()}
              initial={false}
              animate={{ y: top, height: Math.max(h, v == null ? 0 : 1), fill }}
              transition={{ duration: dur(0.5), ease: EASE }}
              rx={Math.min(2, x.bandwidth() / 3)}
              style={{ cursor: "pointer" }}
              onMouseMove={(e) =>
                tip.show(
                  e,
                  <Tip
                    title={`G${i + 1} · ${g.team_location === "HOME" ? "vs" : "@"} ${g.opponent} · ${g.game_result}`}
                    rows={[
                      [def.label, v != null ? def.fmt(v) : "—"],
                      ["PTS / REB / AST", `${g.points} / ${g.total_rebounds} / ${g.assists}`],
                      ["MIN", num(g.minutes_played, 0)],
                      ["TS%", g.true_shooting_pct != null ? pct(g.true_shooting_pct) : "—"],
                      ["+/−", signed(g.plus_minus, 0)],
                    ]}
                  />,
                )
              }
              onMouseLeave={tip.hide}
            />
          );
        })}
        {n > 0 && (
          <motion.line
            x1={L}
            x2={W - R}
            initial={false}
            animate={{ y1: y(avg), y2: y(avg) }}
            transition={{ duration: dur(0.5), ease: EASE }}
            stroke="#2e2b25"
            strokeOpacity={0.55}
            strokeDasharray="4 4"
            pointerEvents="none"
          />
        )}
        {n > 1 && <MorphPath d={rollPath} fill="none" stroke="#56633f" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" pointerEvents="none" />}
        {games.map((g, i) => (
          <rect key={`r${i}`} x={x(i)} y={RIBBON} width={x.bandwidth()} height={8} rx={1.5} fill={g.game_result === "W" ? "#7a8a5e" : "#e3d8c6"} />
        ))}
      </Plot>
      <div className="row note" style={{ gap: 14 }}>
        <span className="row" style={{ gap: 5 }}>
          <span style={{ width: 10, height: 6, borderRadius: 2, background: "#7a8a5e" }} /> Win
        </span>
        <span className="row" style={{ gap: 5 }}>
          <span style={{ width: 10, height: 6, borderRadius: 2, background: "#e3d8c6" }} /> Loss
        </span>
        <span className="row" style={{ gap: 5 }}>
          <span style={{ width: 16, height: 3, borderRadius: 2, background: "#56633f" }} /> 10-game rolling average
        </span>
      </div>
      {tip.node}
    </Card>
  );
}
