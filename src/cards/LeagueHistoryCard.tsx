import { extent } from "d3-array";
import { scaleLinear } from "d3-scale";
import { line } from "d3-shape";
import { motion } from "motion/react";
import { Card } from "../components/Card";
import { Tip, useChartTooltip } from "../components/ChartTooltip";
import { Lab, Plot } from "../components/Plot";
import { useLeagueHistory, type LeagueSeason } from "../lib/api";
import { mix } from "../lib/color";
import { num, pct, seasonLabel, shortYear } from "../lib/format";
import { EASE, useDuration } from "../lib/motion";

const W = 520;
const H = 330;
const L = 40;
const R = 14;
const T = 14;
const B = 296;

const SPARKS: { key: keyof LeagueSeason; label: string }[] = [
  { key: "efg", label: "eFG%" },
  { key: "tov", label: "TOV%" },
  { key: "orb", label: "OREB%" },
  { key: "ftr", label: "FT rate" },
];

function Sparkline({ values }: { values: number[] }) {
  const [lo, hi] = extent(values) as [number, number];
  const n = values.length;
  const d = values
    .map((v, i) => `${i ? "L" : "M"}${(2 + (i / (n - 1)) * 106).toFixed(1)} ${(27 - ((v - lo) / (hi - lo || 1)) * 24).toFixed(1)}`)
    .join(" ");
  return (
    <svg width={110} height={30} viewBox="0 0 110 30" aria-hidden style={{ display: "block", maxWidth: "100%" }}>
      <path d={d} fill="none" stroke="#c67139" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function LeagueHistoryCard() {
  const { data = [] } = useLeagueHistory();
  const tip = useChartTooltip();
  const dur = useDuration();

  const x = scaleLinear().domain([0.15, 0.45]).range([L, W - R]);
  const [pLo, pHi] = (data.length ? extent(data, (d) => d.pace) : [90, 104]) as [number, number];
  const y = scaleLinear()
    .domain([Math.floor(pLo - 1), Math.ceil(pHi + 1)])
    .range([B, T]);
  const [oLo, oHi] = (data.length ? extent(data, (d) => d.ortg) : [100, 120]) as [number, number];
  const fill = (o: number) => mix("#ffc6a5", "#643312", (o - oLo) / (oHi - oLo || 1));
  const path =
    line<LeagueSeason>()
      .x((d) => x(d.three_rate))
      .y((d) => y(d.pace))(data) ?? "";

  const first = data[0];
  const last = data[data.length - 1];
  const yTicks = y.ticks(5);
  const xTicks = [0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45];

  return (
    <Card
      id="1i"
      width={580}
      caption="League history: a connected scatter of pace against three-point rate, one point per season"
      kicker="League history · league_season"
      title="Faster, and further out"
      sub={
        first && last
          ? `${seasonLabel(first.season)} to ${seasonLabel(last.season)} · threes went from ${pct(first.three_rate, 0)}% to ${pct(last.three_rate, 0)}% of shots`
          : " "
      }
    >
      <Plot
        w={W}
        h={H}
        svgProps={{ "aria-label": "Pace by three-point attempt rate, by season" }}
        labels={
          <>
            {xTicks.map((t) => (
              <Lab key={t} x={x(t)} y={309} w={W} h={H} ax="middle" ay="top" className="tick">
                {pct(t, 0)}%
              </Lab>
            ))}
            {yTicks.map((t) => (
              <Lab key={t} x={34} y={y(t)} w={W} h={H} ax="end" className="tick">
                {t}
              </Lab>
            ))}
            <Lab x={W - R} y={B - 8} w={W} h={H} ax="end" ay="bottom" className="axis-title">
              Share of FGA from three
            </Lab>
            <Lab x={L + 4} y={T} w={W} h={H} ax="start" ay="top" className="axis-title" style={{ transform: "rotate(-90deg) translate(-100%, 0)", transformOrigin: "0 0" }}>
              Pace
            </Lab>
            {data.map((d, i) =>
              i % 4 === 0 || i === data.length - 1 ? (
                <Lab key={d.season} x={x(d.three_rate) + 9} y={y(d.pace) - 8} w={W} h={H} ay="bottom" halo style={{ fontSize: 10.5, fontWeight: 700, color: "#474238" }}>
                  {shortYear(d.season)}
                </Lab>
              ) : null,
            )}
          </>
        }
      >
        {yTicks.map((t) => (
          <line key={t} x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="rgba(32,30,29,.07)" />
        ))}
        {xTicks.map((t) => (
          <line key={t} x1={x(t)} x2={x(t)} y1={T} y2={B} stroke="rgba(32,30,29,.07)" />
        ))}
        <motion.path
          d={path}
          fill="none"
          stroke="#c0b6a5"
          strokeWidth={2.5}
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: dur(1.2), ease: EASE }}
        />
        {data.map((d, i) => {
          const end = i === 0 || i === data.length - 1;
          return (
            <motion.circle
              key={d.season}
              cx={x(d.three_rate)}
              cy={y(d.pace)}
              r={end ? 7.5 : 5.5}
              fill={fill(d.ortg)}
              stroke="#fbf7f0"
              strokeWidth={1.6}
              style={{ cursor: "pointer" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: dur(i * 0.03), duration: dur(0.4) }}
              onMouseMove={(e) =>
                tip.show(
                  e,
                  <Tip
                    title={seasonLabel(d.season)}
                    rows={[
                      ["3PA rate", `${pct(d.three_rate)}%`],
                      ["Pace", num(d.pace)],
                      ["ORtg", num(d.ortg)],
                      ["eFG%", pct(d.efg)],
                    ]}
                  />,
                )
              }
              onMouseLeave={tip.hide}
            />
          );
        })}
      </Plot>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10.5, color: "#645c50" }}>
        <span>Offensive rating</span>
        <span style={{ width: 90, height: 8, borderRadius: 999, background: "linear-gradient(90deg,#ffc6a5,#643312)" }} />
        <span className="num">
          {num(oLo)} → {num(oHi)}
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 10 }}>
        {SPARKS.map((s) => {
          const vals = data.map((d) => d[s.key] as number);
          return (
            <div className="tile" key={s.key} style={{ gap: 6 }}>
              <div className="tile-label">{s.label}</div>
              <div className="num" style={{ fontSize: 12, fontWeight: 700 }}>
                {first ? `${pct(vals[0])} → ${pct(vals[vals.length - 1])}` : "—"}
              </div>
              {vals.length > 1 && <Sparkline values={vals} />}
            </div>
          );
        })}
      </div>
      {tip.node}
    </Card>
  );
}
