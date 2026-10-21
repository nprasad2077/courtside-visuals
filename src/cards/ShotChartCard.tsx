import { hexbin as d3hexbin } from "d3-hexbin";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { Card } from "../components/Card";
import { Tip, useChartTooltip } from "../components/ChartTooltip";
import { CourtLines } from "../components/Court";
import { PlayerSelect } from "../components/PlayerSelect";
import { Lab, Plot } from "../components/Plot";
import { SeasonSlider } from "../components/SeasonSlider";
import { Segmented } from "../components/Segmented";
import { StatTile } from "../components/StatTile";
import { useLeagueZones, useSeasonFor, useShots, usePlayersWithShots, type Shot } from "../lib/api";
import { diverging } from "../lib/color";
import { COURT_H, COURT_W, ZONES, zoneKey } from "../lib/court";
import { clock, num, pct, signed } from "../lib/format";
import { useDuration, useTransition } from "../lib/motion";

type Mode = "dots" | "hex" | "zones";
type Period = "all" | "1" | "2" | "3" | "4" | "ot";
type Result = "all" | "made" | "missed";

const HEX_R = 13;
const GRID = 14;
const cx = (x: number) => Math.min(COURT_W, Math.max(0, x));
const cy = (y: number) => Math.min(COURT_H - 2, Math.max(0, y));
const value = (s: Shot) => (s.three ? 3 : 2);

const hex = d3hexbin<Shot>()
  .x((s) => cx(s.x))
  .y((s) => cy(s.y))
  .radius(HEX_R)
  .extent([
    [0, 0],
    [COURT_W, COURT_H],
  ]);

/** Grid points for the dot matrix, classified once. */
const MATRIX = (() => {
  const pts: { x: number; y: number; key: string }[] = [];
  for (let y = GRID / 2; y < COURT_H; y += GRID) for (let x = GRID / 2; x < COURT_W; x += GRID) pts.push({ x, y, key: zoneKey(x, y).key });
  return pts;
})();

export function ShotChartCard() {
  const players = usePlayersWithShots().data ?? [];
  const [id, setId] = useState("curryst01");
  const { season, setSeason, seasons } = useSeasonFor(id, { shots: true, initial: 2016 });
  const shotsQ = useShots(id, season);
  const lg = useLeagueZones(season).data ?? {};
  const [mode, setMode] = useState<Mode>("dots");
  const [period, setPeriod] = useState<Period>("all");
  const [result, setResult] = useState<Result>("all");
  const [off, setOff] = useState<Set<string>>(new Set());
  const tip = useChartTooltip();
  const dur = useDuration();
  const tr = useTransition();

  const all = useMemo(() => shotsQ.data ?? [], [shotsQ.data]);
  const hasOT = all.some((s) => s.q >= 5);
  const inPeriod = useMemo(
    () => all.filter((s) => period === "all" || (period === "ot" ? s.q >= 5 : s.q === Number(period))),
    [all, period],
  );
  const shots = useMemo(() => inPeriod.filter((s) => !off.has(s.zone)), [inPeriod, off]);
  const dots = useMemo(
    () =>
      shots
        .map((s, i) => ({ s, i }))
        .filter(({ s }) => result === "all" || (result === "made") === s.made)
        // Misses underneath makes.
        .sort((a, b) => Number(a.s.made) - Number(b.s.made)),
    [shots, result],
  );

  const lgPct = (zone: string) => lg[zone] ?? 0;
  const n = shots.length;
  const made = shots.filter((s) => s.made).length;
  const threesMade = shots.filter((s) => s.made && s.three).length;
  const expFg = n ? shots.reduce((a, s) => a + lgPct(s.zone), 0) / n : 0;
  const expPps = n ? shots.reduce((a, s) => a + lgPct(s.zone) * value(s), 0) / n : 0;
  const pts = shots.reduce((a, s) => a + (s.made ? value(s) : 0), 0);

  const bins = useMemo(() => {
    const b = hex(shots);
    const maxN = Math.max(1, ...b.map((x) => x.length));
    return b.map((bin) => {
      const m = bin.filter((s) => s.made).length;
      const expected = bin.reduce((a, s) => a + lgPct(s.zone), 0);
      const k = bin.length;
      const shrunk = ((m - expected) / k) * (k / (k + 3));
      return { x: bin.x, y: bin.y, n: k, m, expected, shrunk, size: Math.max(0.34, Math.sqrt(k / maxN)) * HEX_R * 0.98 };
    });
    // lg is captured through lgPct.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shots, lg]);

  const sub = useMemo(() => {
    const agg = new Map<string, { n: number; m: number; exp: number; sx: number; sy: number }>();
    for (const s of shots) {
      const k = zoneKey(cx(s.x), cy(s.y)).key;
      const a = agg.get(k) ?? { n: 0, m: 0, exp: 0, sx: 0, sy: 0 };
      a.n++;
      a.m += Number(s.made);
      a.exp += lgPct(s.zone);
      a.sx += cx(s.x);
      a.sy += cy(s.y);
      agg.set(k, a);
    }
    return agg;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shots, lg]);

  // The matrix's own centroids place labels; shot centroids would pull them toward the rim.
  const centroids = useMemo(() => {
    const c = new Map<string, { x: number; y: number; k: number }>();
    for (const p of MATRIX) {
      const a = c.get(p.key) ?? { x: 0, y: 0, k: 0 };
      a.x += p.x;
      a.y += p.y;
      a.k++;
      c.set(p.key, a);
    }
    return c;
  }, []);

  // Biggest samples claim their spot first; a smaller sub-zone whose label would land within 34 px is skipped.
  const zoneLabels = useMemo(() => {
    const placed: { k: string; a: { n: number; m: number }; x: number; y: number }[] = [];
    for (const [k, a] of [...sub].sort((p, q) => q[1].n - p[1].n)) {
      const c = centroids.get(k);
      if (!c || a.n < 6) continue;
      const x = Math.min(COURT_W - 26, Math.max(26, c.x / c.k));
      const y = c.y / c.k;
      if (placed.every((p) => Math.hypot(p.x - x, p.y - y) >= 34)) placed.push({ k, a, x, y });
    }
    return placed;
  }, [sub, centroids]);

  const zoneRows = ZONES.map((z) => {
    const zs = inPeriod.filter((s) => s.zone === z.key);
    const zm = zs.filter((s) => s.made).length;
    const fg = zs.length ? zm / zs.length : null;
    return { ...z, n: zs.length, fg, diff: fg != null && lg[z.key] != null ? fg - lg[z.key] : null };
  });
  const maxShare = Math.max(0.01, ...zoneRows.map((z) => z.n / Math.max(1, inPeriod.length)));

  const toggle = (k: string) =>
    setOff((cur) => {
      const next = new Set(cur);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  const name = players.find((p) => p.id === id)?.name ?? "";
  const shotTip = (s: Shot) => (
    <Tip
      title={`${s.made ? "Made" : "Missed"} ${s.three ? "3PT" : "2PT"} · ${s.dist} ft`}
      rows={[
        ["Zone", ZONES.find((z) => z.key === s.zone)?.short ?? s.zone],
        ["Clock", `${s.q >= 5 ? `OT${s.q - 4}` : `Q${s.q}`} · ${clock(s.secs)} left`],
        ["Margin", s.margin === 0 ? "Tied" : signed(s.margin, 0)],
        ["Clutch", s.clutch ? "Yes" : "No"],
      ]}
    />
  );

  return (
    <Card
      id="1a"
      width={820}
      caption="Every field-goal attempt in a season on a half court, as dots, hexbins or zones against the league"
      kicker="Shot chart · int_player_shots_enriched"
      title={name ? `${name}'s shot chart` : "Shot chart"}
      sub={`${n.toLocaleString("en-US")} field-goal attempts · free throws excluded · league baseline is the 34-player shot pool`}
      controls={
        <>
          <div className="row">
            <PlayerSelect value={id} onChange={setId} />
            <SeasonSlider value={season} onChange={setSeason} seasons={seasons} />
          </div>
        </>
      }
    >
      <div className="row" style={{ gap: 8 }}>
        <Segmented
          options={[
            { value: "dots", label: "Dots" },
            { value: "hex", label: "Hexbin" },
            { value: "zones", label: "Zones vs league" },
          ]}
          value={mode}
          onChange={setMode}
          label="Mode"
          size="sm"
        />
        <Segmented
          options={[
            { value: "all", label: "All" },
            { value: "1", label: "Q1" },
            { value: "2", label: "Q2" },
            { value: "3", label: "Q3" },
            { value: "4", label: "Q4" },
            { value: "ot", label: "OT", disabled: !hasOT, title: hasOT ? undefined : "No OT shots in data" },
          ]}
          value={period}
          onChange={setPeriod}
          label="Period"
          size="sm"
        />
        <Segmented
          options={[
            { value: "all", label: "All" },
            { value: "made", label: "Made" },
            { value: "missed", label: "Missed" },
          ]}
          value={result}
          onChange={setResult}
          label="Result"
          size="sm"
          dim={mode !== "dots"}
        />
        {mode !== "dots" && <span className="note">Result filter applies to Dots only</span>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 330px), 1fr))", gap: 20, alignItems: "start" }}>
        <Plot
          w={COURT_W}
          h={COURT_H}
          style={{ background: "#f1e3ca", borderRadius: 24, overflow: "hidden" }}
          svgProps={{ "aria-label": `${name} shot chart`, style: { overflow: "hidden" } }}
          labels={
            mode === "zones" ? (
              <>
                {zoneLabels.map(({ k, a, x, y }) => {
                  return (
                    <Lab key={k} x={x} y={y} w={COURT_W} h={COURT_H} ax="middle" halo style={{ textAlign: "center", color: "#2e2b25" }}>
                      <div className="num" style={{ fontSize: 13, fontWeight: 800 }}>
                        {pct(a.m / a.n, 0)}
                      </div>
                      <div className="num" style={{ fontSize: 9.5, fontWeight: 600, marginTop: 2 }}>
                        {a.m}/{a.n}
                      </div>
                    </Lab>
                  );
                })}
              </>
            ) : null
          }
        >
          {mode === "zones" &&
            MATRIX.map((p) => {
              const a = sub.get(p.key);
              const zi = Number(p.key[0]);
              const zoneOff = off.has(ZONES[zi].key);
              const fill = a && !zoneOff ? diverging(((a.m - a.exp) / a.n) * (a.n / (a.n + 4)), 0.12) : "#dcd3c4";
              return (
                <circle
                  key={`${p.x}-${p.y}`}
                  cx={p.x}
                  cy={p.y}
                  r={5.3}
                  fill={fill}
                  opacity={a && !zoneOff ? 0.95 : 0.4}
                  style={{ transition: tr("fill, opacity", 0.4) }}
                  onMouseMove={(e) =>
                    a
                      ? tip.show(
                          e,
                          <Tip
                            title={ZONES[zi].short}
                            rows={[
                              ["Shots", `${a.m}/${a.n}`],
                              ["FG%", pct(a.m / a.n)],
                              ["League", pct(a.exp / a.n)],
                            ]}
                          />,
                        )
                      : tip.hide()
                  }
                  onMouseLeave={tip.hide}
                />
              );
            })}
          <CourtLines />
          {mode === "hex" &&
            bins.map((b) => (
              <motion.path
                key={`${b.x}-${b.y}`}
                transform={`translate(${b.x},${b.y})`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, d: hex.hexagon(b.size) }}
                transition={{ duration: dur(0.5) }}
                fill={diverging(b.shrunk, 0.14)}
                stroke="#fbf7f0"
                strokeWidth={1.2}
                style={{ cursor: "pointer" }}
                onMouseMove={(e) =>
                  tip.show(
                    e,
                    <Tip
                      title={`${b.n} attempt${b.n === 1 ? "" : "s"}`}
                      rows={[
                        ["FG%", pct(b.m / b.n)],
                        ["League expected", pct(b.expected / b.n)],
                        ["Makes vs expected", signed(b.m - b.expected)],
                      ]}
                    />,
                  )
                }
                onMouseLeave={tip.hide}
              />
            ))}
          {mode === "dots" && (
            <AnimatePresence initial={true}>
              {dots.map(({ s, i }, k) => (
                <motion.circle
                  key={`${id}-${season}-${i}`}
                  cx={cx(s.x)}
                  cy={cy(s.y)}
                  r={s.made ? 4.6 : 3.8}
                  fill={s.made ? "#c67139" : "#fbf7f0"}
                  stroke={s.made ? "#8c491a" : "#728157"}
                  strokeWidth={1.6}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, transition: { duration: dur(0.2) } }}
                  transition={{ duration: dur(0.4), delay: dur(Math.min(0.4, k * 0.001)) }}
                  style={{ cursor: "pointer", transformBox: "fill-box", transformOrigin: "center" }}
                  onMouseMove={(e) => tip.show(e, shotTip(s))}
                  onMouseLeave={tip.hide}
                />
              ))}
            </AnimatePresence>
          )}
        </Plot>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 10 }}>
            <StatTile label="FGA" value={n.toLocaleString("en-US")} sub={`${made} made`} />
            <StatTile label="FG%" value={n ? pct(made / n) : "—"} sub={`lg-expected ${pct(expFg)}%`} />
            <StatTile label="eFG%" value={n ? pct((made + 0.5 * threesMade) / n) : "—"} sub={`${threesMade} threes made`} />
            <StatTile label="Pts / shot" value={n ? num(pts / n, 2) : "—"} sub={`lg-expected ${num(expPps, 2)}`} />
          </div>
          <div role="table" aria-label="Zones" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {zoneRows.map((z) => {
              const isOff = off.has(z.key);
              return (
                <button
                  key={z.key}
                  type="button"
                  aria-pressed={!isOff}
                  onClick={() => toggle(z.key)}
                  title={isOff ? "Show this zone" : "Hide this zone"}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "10px minmax(0,1.3fr) minmax(0,1fr) 38px 44px",
                    gap: 8,
                    alignItems: "center",
                    padding: "6px 8px",
                    border: 0,
                    borderRadius: 12,
                    background: "transparent",
                    cursor: "pointer",
                    textAlign: "left",
                    font: "inherit",
                    color: "inherit",
                    opacity: isOff ? 0.38 : 1,
                    transition: "opacity .2s",
                  }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: isOff ? "#a19786" : "#d67f48" }} />
                  <span style={{ minWidth: 0 }}>
                    <span style={{ fontSize: 12, fontWeight: 700 }}>{z.short}</span>{" "}
                    <span style={{ fontSize: 10.5, color: "#82796a" }}>{z.range}</span>
                  </span>
                  <span style={{ height: 8, borderRadius: 999, background: "#eee7db", overflow: "hidden" }}>
                    <span
                      style={{
                        display: "block",
                        height: "100%",
                        borderRadius: 999,
                        background: "#d67f48",
                        width: `${(z.n / Math.max(1, inPeriod.length) / maxShare) * 100}%`,
                        transition: tr("width", 0.5),
                      }}
                    />
                  </span>
                  <span className="num" style={{ fontSize: 12, fontWeight: 700, textAlign: "right" }}>
                    {z.fg != null ? pct(z.fg) : "—"}
                  </span>
                  <span className="num" style={{ fontSize: 11, fontWeight: 700, textAlign: "right", color: z.diff == null ? "#82796a" : z.diff >= 0 ? "#8c491a" : "#56633f" }}>
                    {z.diff != null ? signed(z.diff * 100) : ""}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="note">
            {mode === "dots"
              ? "Terracotta dots are makes; hollow dots are misses."
              : mode === "hex"
                ? "Hex size is attempts; color is makes above (terracotta) or below (sage) the league rate for those zones, shrunk toward par for small samples."
                : "Each dot takes its sub-zone's FG% against the league, shrunk toward par for small samples."}{" "}
            Click a zone row to hide it.
          </div>
        </div>
      </div>
      {tip.node}
    </Card>
  );
}
