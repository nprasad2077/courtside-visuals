import { scaleLinear } from "d3-scale";
import { line } from "d3-shape";
import { Fragment, useState } from "react";
import { Card } from "../components/Card";
import { Tip, useChartTooltip } from "../components/ChartTooltip";
import { MorphPath } from "../components/MorphPath";
import { Lab, Plot } from "../components/Plot";
import { range, SeasonSlider } from "../components/SeasonSlider";
import { Segmented } from "../components/Segmented";
import { useMeta, useRace, useTeamSeason, type Conf } from "../lib/api";
import { seasonLabel, signed, winPct } from "../lib/format";
import { useTransition } from "../lib/motion";
import { spreadLabels } from "../lib/stats";

const W = 520;
const H = 340;
const L = 34;
const R = 40;
const T = 10;
const B = 312;

/** "Golden State Warriors" → "Warriors", "Portland Trail Blazers" → "Trail Blazers". */
const nickname = (name: string) => (/Trail Blazers$/.test(name) ? "Trail Blazers" : name.split(" ").pop()!);

export function StandingsRaceCard() {
  const meta = useMeta();
  const [season, setSeason] = useState(2015);
  const [conf, setConf] = useState<Conf>("W");
  const [hot, setHot] = useState<string | null>(null);
  const race = useRace(season, conf).data ?? [];
  const table = (useTeamSeason(season).data ?? []).filter((t) => t.conf === conf).sort((a, b) => a.seed - b.seed);
  const tip = useChartTooltip();
  const tr = useTransition();

  const seedOf = new Map(table.map((t) => [t.abbr, t.seed]));
  const games = Math.max(82, ...race.map((r) => r.series.length));
  const vals = race.flatMap((r) => r.series);
  const top = Math.ceil(Math.max(10, ...vals) / 10) * 10;
  const bot = Math.floor(Math.min(-10, ...vals) / 10) * 10;
  const x = scaleLinear().domain([1, games]).range([L, W - R]);
  const y = scaleLinear().domain([bot, top]).range([B, T]);
  const path = line<number>()
    .x((_, i) => x(i + 1))
    .y((v) => y(v));
  const yTicks = range(bot / 10, top / 10).map((k) => k * 10);
  const xTicks = [1, 20, 40, 60, 82];

  const ends = race.map((r) => y(r.series[r.series.length - 1] ?? 0));
  const endY = spreadLabels(ends, 10.5, T, B);

  // Draw low seeds first, the hovered team last.
  const order = [...race].sort((a, b) => {
    if (a.team === hot) return 1;
    if (b.team === hot) return -1;
    return (seedOf.get(b.team) ?? 99) - (seedOf.get(a.team) ?? 99);
  });

  const leader = table[0];
  const title = leader ? `${conf === "W" ? "West" : "East"} race · ${nickname(leader.name)} finish ${leader.w}–${leader.l}` : "Standings race";

  return (
    <Card
      id="1f"
      width={940}
      caption="Games over .500 through the season for every team in a conference, with the final table"
      kicker="Standings race · int_team_performance"
      title={title}
      sub={`${seasonLabel(season)} regular season · hover a line or a row to follow one team`}
      onMouseLeave={() => setHot(null)}
      controls={
        <div className="row">
          <Segmented
            options={[
              { value: "E", label: "East" },
              { value: "W", label: "West" },
            ]}
            value={conf}
            onChange={setConf}
            label="Conference"
            size="sm"
          />
          <SeasonSlider value={season} onChange={setSeason} seasons={meta.data ? range(...meta.data.seasons) : [season]} />
        </div>
      }
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 400px), 1fr))", gap: 24, alignItems: "start" }}>
        <Plot
          w={W}
          h={H}
          svgProps={{ "aria-label": "Games over .500 by game number" }}
          labels={
            <>
              {yTicks.map((t) => (
                <Lab key={t} x={L - 6} y={y(t)} w={W} h={H} ax="end" className="tick">
                  {t === 0 ? "0" : signed(t, 0)}
                </Lab>
              ))}
              {xTicks.map((t) => (
                <Lab key={t} x={x(t)} y={B + 9} w={W} h={H} ax="middle" ay="top" className="tick">
                  {t === 1 ? "G1" : t}
                </Lab>
              ))}
              {race.map((r, i) => (
                <Lab
                  key={r.team}
                  x={x(r.series.length) + 5}
                  y={endY[i]}
                  w={W}
                  h={H}
                  halo
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    color: r.color,
                    opacity: hot && hot !== r.team ? 0.25 : 1,
                    transition: tr("top, left, opacity", 0.6),
                  }}
                >
                  {r.team}
                </Lab>
              ))}
            </>
          }
        >
          {yTicks.map((t) => (
            <line key={t} x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke={t === 0 ? "#a19786" : "rgba(32,30,29,.07)"} strokeWidth={t === 0 ? 1.4 : 1} />
          ))}
          {order.map((r) => {
            const seed = seedOf.get(r.team) ?? 99;
            const op = hot ? (hot === r.team ? 1 : 0.13) : seed <= 6 ? 0.9 : 0.45;
            return (
              <MorphPath
                key={r.team}
                d={path(r.series) ?? ""}
                fill="none"
                stroke={r.color}
                strokeWidth={hot === r.team ? 3.6 : 1.8}
                strokeOpacity={op}
                strokeLinejoin="round"
                style={{ cursor: "pointer", transition: tr("stroke-opacity, stroke-width", 0.3) }}
                onMouseEnter={() => setHot(r.team)}
                onMouseMove={(e) => {
                  const t = table.find((s) => s.abbr === r.team);
                  tip.show(e, <Tip title={t?.name ?? r.team} rows={[["Final", t ? `${t.w}–${t.l}` : "—"], ["Seed", seed === 99 ? "—" : seed], ["Peak", signed(Math.max(...r.series), 0)]]} />);
                }}
                onMouseLeave={tip.hide}
              />
            );
          })}
        </Plot>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
          <div
            role="table"
            aria-label="Conference standings"
            style={{ display: "grid", gridTemplateColumns: "22px minmax(0,1fr) 50px 42px 46px 40px 36px", fontSize: 12, alignItems: "center" }}
          >
            {["#", "Team", "W-L", "PCT", "NET", "L10", "STK"].map((h, i) => (
              <span key={h} className="tile-label" style={{ padding: "0 4px 6px", textAlign: i > 1 ? "right" : "left" }}>
                {h}
              </span>
            ))}
            {table.map((t) => {
              const bg = hot === t.abbr ? "#f1e3ca" : "transparent";
              const cell = { padding: "5px 4px", background: bg, transition: "background .2s", textAlign: "right" as const };
              const sep = t.seed === 6 || t.seed === 10;
              return (
                <Fragment key={t.abbr}>
                  <div role="row" style={{ display: "contents", cursor: "pointer" }} onMouseEnter={() => setHot(t.abbr)}>
                    <span className="num" style={{ ...cell, textAlign: "left", color: "#82796a", borderRadius: "8px 0 0 8px" }}>
                      {t.seed}
                    </span>
                    <span style={{ ...cell, textAlign: "left", display: "flex", alignItems: "center", gap: 6, fontWeight: 700, minWidth: 0 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: t.color, flex: "none" }} />
                      {t.abbr}
                    </span>
                    <span className="num" style={cell}>
                      {t.w}-{t.l}
                    </span>
                    <span className="num" style={cell}>
                      {winPct(t.w, t.w + t.l)}
                    </span>
                    <span className="num" style={{ ...cell, fontWeight: 700, color: t.net >= 0 ? "#8c491a" : "#56633f" }}>
                      {signed(t.net)}
                    </span>
                    <span className="num" style={cell}>
                      {t.last10}-{t.last10Games - t.last10}
                    </span>
                    <span className="num" style={{ ...cell, borderRadius: "0 8px 8px 0" }}>
                      {t.streak}
                    </span>
                  </div>
                  {sep && <div style={{ gridColumn: "1 / -1", borderTop: "1px dashed rgba(32,30,29,.25)", margin: "3px 0" }} />}
                </Fragment>
              );
            })}
          </div>
          <div className="note">
            Dashed lines fall after seed 6 (straight into the playoffs) and seed 10 (last play-in spot). Seeds here rank by wins, then net rating, so
            they can differ from official tiebreakers.
            {table.length > 0 && table.length < 15 && ` The data has ${table.length} teams in this conference this season.`}
          </div>
        </div>
      </div>
      {tip.node}
    </Card>
  );
}
