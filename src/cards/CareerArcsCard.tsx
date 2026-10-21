import { scaleLinear } from "d3-scale";
import { line } from "d3-shape";
import { X } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { Card } from "../components/Card";
import { Tip, useChartTooltip } from "../components/ChartTooltip";
import { MorphPath } from "../components/MorphPath";
import { PlayerSearch } from "../components/PlayerSearch";
import { Lab, Plot } from "../components/Plot";
import { Segmented } from "../components/Segmented";
import { useCareers, useTopPlayers, type PlayerSeason } from "../lib/api";
import { lastName, num, pct, seasonLabel, shortYear, signed } from "../lib/format";
import { EASE, useDuration } from "../lib/motion";
import { spreadLabels } from "../lib/stats";

const PALETTE = ["#c67139", "#56633f", "#4f6d8f", "#7b4b6a", "#c79a2e", "#2e2b25"];
const MAX = 6;

type StatKey = "pts" | "reb" | "ast" | "ts" | "bpm";
type Mode = "per" | "cum";
type Align = "year" | "season";

const STATS: { value: StatKey; label: string; rate: boolean; fmt: (v: number) => string }[] = [
  { value: "pts", label: "PTS", rate: false, fmt: (v) => num(v) },
  { value: "reb", label: "REB", rate: false, fmt: (v) => num(v) },
  { value: "ast", label: "AST", rate: false, fmt: (v) => num(v) },
  { value: "ts", label: "TS%", rate: true, fmt: (v) => pct(v) },
  { value: "bpm", label: "BPM", rate: true, fmt: (v) => signed(v) },
];
const TOTAL: Record<"pts" | "reb" | "ast", keyof PlayerSeason> = { pts: "tot_pts", reb: "tot_reb", ast: "tot_ast" };

const W = 620;
const H = 300;
const L = 40;
const R = 84;
const T = 12;
const B = 270;

interface Pick {
  id: string;
  color: string;
}
interface Pt {
  s: PlayerSeason;
  year: number;
  x: number;
  v: number;
}

const fmtBig = (v: number) => (v >= 10000 ? `${(v / 1000).toFixed(1)}k` : Math.round(v).toLocaleString("en-US"));

export function CareerArcsCard() {
  const top = useTopPlayers(4);
  const [picks, setPicks] = useState<Pick[] | null>(null);
  const [hint, setHint] = useState(false);
  const [stat, setStat] = useState<StatKey>("pts");
  const [mode, setMode] = useState<Mode>("per");
  const [align, setAlign] = useState<Align>("year");
  const tip = useChartTooltip();
  const dur = useDuration();

  useEffect(() => {
    if (picks == null && top.data) setPicks(top.data.map((id, i) => ({ id, color: PALETTE[i] })));
  }, [top.data, picks]);

  const list = picks ?? [];
  const careers = useCareers(list.map((p) => p.id));
  const def = STATS.find((s) => s.value === stat)!;

  const add = (id: string) =>
    setPicks((cur) => {
      const now = cur ?? [];
      if (now.some((p) => p.id === id)) return now;
      const kept = now.length >= MAX ? now.slice(1) : now;
      setHint(now.length >= MAX);
      const used = new Set(kept.map((p) => p.color));
      return [...kept, { id, color: PALETTE.find((c) => !used.has(c)) ?? PALETTE[0] }];
    });
  const remove = (id: string) => {
    setHint(false);
    setPicks((cur) => (cur ?? []).filter((p) => p.id !== id));
  };

  const series = useMemo(
    () =>
      list.flatMap((p, i) => {
        const c = careers[i]?.data;
        if (!c) return [];
        let gp = 0;
        let acc = 0;
        const pts: Pt[] = c.seasons.map((s, k) => {
          let v: number;
          if (mode === "per") v = s[stat] as number;
          else if (!def.rate) v = acc += s[TOTAL[stat as "pts"]] as number;
          else {
            // Games-weighted career average to date.
            acc += (s[stat] as number) * s.gp;
            v = acc / (gp + s.gp);
          }
          gp += s.gp;
          return { s, year: k + 1, x: align === "year" ? k + 1 : s.season, v };
        });
        return [{ ...p, name: c.name, pts }];
      }),
    [list, careers, stat, mode, align, def.rate],
  );

  const all = series.flatMap((s) => s.pts);
  const xs = all.map((p) => p.x);
  const vs = all.map((p) => p.v);
  const x = scaleLinear()
    .domain(xs.length ? [Math.min(...xs), Math.max(...xs)] : [1, 20])
    .range([L, W - R]);
  const lo = def.rate ? Math.min(...vs) : 0;
  const y = scaleLinear()
    .domain(vs.length ? [lo, Math.max(...vs)] : [0, 30])
    .range([B, T])
    .nice();
  const path = line<Pt>()
    .x((p) => x(p.x))
    .y((p) => y(p.v));

  const ends = series.map((s) => y(s.pts[s.pts.length - 1].v));
  const endY = spreadLabels(ends, 13, T, B);
  const xTicks = align === "year" ? x.ticks(8).filter(Number.isInteger) : x.ticks(6).filter(Number.isInteger);

  const fmtV = (v: number) => (mode === "cum" && !def.rate ? fmtBig(v) : def.fmt(v));

  return (
    <Card
      id="1h"
      width={720}
      caption="Career arcs for up to six players, season by season"
      kicker="Career arcs · int_player_performance"
      title="How careers rise and bend"
      sub={align === "year" ? "Aligned by career year: year 1 is each player's first season in the data" : "Aligned by calendar season"}
      controls={
        <PlayerSearch
          mode="add"
          excludeIds={list.map((p) => p.id)}
          onSelect={(p) => add(p.id)}
          align="right"
          placeholder="Add a player"
          label="Add a player"
        />
      }
    >
      <div className="row" style={{ gap: 6 }}>
        {series.map((s) => (
          <span key={s.id} className="tag-pill" style={{ background: s.color, color: "#fbf7f0", gap: 4, paddingRight: 4 }}>
            {s.name}
            <button
              type="button"
              aria-label={`Remove ${s.name}`}
              onClick={() => remove(s.id)}
              style={{ border: 0, background: "rgba(251,247,240,.18)", color: "inherit", borderRadius: 999, width: 18, height: 18, display: "grid", placeItems: "center", cursor: "pointer", padding: 0 }}
            >
              <X size={11} strokeWidth={2.75} />
            </button>
          </span>
        ))}
        {hint && <span className="note">Max 6: dropped the oldest pick</span>}
      </div>

      <div className="row" style={{ gap: 8 }}>
        <Segmented options={STATS} value={stat} onChange={setStat} label="Stat" size="sm" />
        <Segmented
          options={[
            { value: "per", label: "Per game" },
            { value: "cum", label: "Cumulative" },
          ]}
          value={mode}
          onChange={setMode}
          label="Mode"
          size="sm"
        />
        <Segmented
          options={[
            { value: "year", label: "By career year" },
            { value: "season", label: "By season" },
          ]}
          value={align}
          onChange={setAlign}
          label="Align"
          size="sm"
        />
      </div>

      <Plot
        w={W}
        h={H}
        svgProps={{ "aria-label": `Career ${def.label} by ${align === "year" ? "career year" : "season"}` }}
        labels={
          <>
            {y.ticks(5).map((t) => (
              <Lab key={t} x={L - 6} y={y(t)} w={W} h={H} ax="end" className="tick">
                {fmtV(t)}
              </Lab>
            ))}
            {xTicks.map((t) => (
              <Lab key={t} x={x(t)} y={B + 10} w={W} h={H} ax="middle" ay="top" className="tick">
                {align === "year" ? `Y${t}` : shortYear(t)}
              </Lab>
            ))}
            {series.map((s, i) => {
              const last = s.pts[s.pts.length - 1];
              return (
                <Lab
                  key={s.id}
                  x={x(last.x) + 8}
                  y={endY[i]}
                  w={W}
                  h={H}
                  halo
                  style={{ fontSize: 11, fontWeight: 800, color: s.color, transition: "top .6s cubic-bezier(.3,.7,.2,1), left .6s cubic-bezier(.3,.7,.2,1)" }}
                >
                  {lastName(s.name)}
                </Lab>
              );
            })}
          </>
        }
      >
        {y.ticks(5).map((t) => (
          <line key={t} x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke={t === 0 && def.rate ? "#a19786" : "rgba(32,30,29,.07)"} />
        ))}
        {series.map((s) => (
          <MorphPath key={s.id} d={path(s.pts) ?? ""} fill="none" stroke={s.color} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {series.map((s) =>
          s.pts.map((p) => (
            <motion.circle
              key={`${s.id}-${p.s.season}`}
              initial={{ cx: x(p.x), cy: y(p.v), opacity: 0 }}
              animate={{ cx: x(p.x), cy: y(p.v), opacity: 1 }}
              transition={{ duration: dur(0.6), ease: EASE }}
              r={4.2}
              fill="#fbf7f0"
              stroke={s.color}
              strokeWidth={2}
              style={{ cursor: "pointer" }}
              onMouseMove={(e) =>
                tip.show(
                  e,
                  <Tip
                    title={`${s.name} · ${seasonLabel(p.s.season)}`}
                    rows={[
                      ["Career year", p.year],
                      [mode === "cum" ? `${def.label} (to date)` : def.label, fmtV(p.v)],
                      ["Team", p.s.team],
                      ["GP", p.s.gp],
                      ["PTS / REB / AST", `${num(p.s.pts)} / ${num(p.s.reb)} / ${num(p.s.ast)}`],
                    ]}
                  />,
                )
              }
              onMouseLeave={tip.hide}
            />
          )),
        )}
      </Plot>
      <div className="note">
        {mode === "cum"
          ? def.rate
            ? `Cumulative ${def.label} is the games-weighted career average to date.`
            : `Cumulative ${def.label} is the running career total.`
          : "Per-game averages by season."}{" "}
        The data has no birth dates, so arcs align by career year rather than age.
      </div>
      {tip.node}
    </Card>
  );
}
