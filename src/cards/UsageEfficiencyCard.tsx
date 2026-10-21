import { scaleLinear, type ScaleLinear } from "d3-scale";
import { Maximize2, Search, ZoomIn, ZoomOut } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { Card } from "../components/Card";
import { Tip, useChartTooltip } from "../components/ChartTooltip";
import { Lab, Plot } from "../components/Plot";
import { range, SeasonSlider } from "../components/SeasonSlider";
import { Segmented } from "../components/Segmented";
import { useMeta, useRotation, type RotationPlayer } from "../lib/api";
import { diverging } from "../lib/color";
import { lastName, num, pct, seasonLabel, signed } from "../lib/format";
import { placeLabels } from "../lib/labels";
import { EASE, useDuration, useTransition } from "../lib/motion";
import { mean, percentile } from "../lib/stats";
import { clampDomain, nearest, panBy, quantile, zoomAround, type Domain } from "../lib/zoom";

const W = 1000;
const H = 560;
const L = 46;
const R = 14;
const T = 14;
const B = 526;
/** Dots at the clamped edge poke past the plot area by up to a radius; the clip leaves room for them. */
const CLIP_PAD = 9;
const HOVER_PX = 18;
const MIN_SPAN = { x: 2, y: 0.02 };

const radius = (mpg: number) => 2 + (mpg / 38) * 6.5;
const clamp = (v: number, d: Domain) => Math.min(d[1], Math.max(d[0], v));
const key = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const span = (d: Domain) => d[1] - d[0];

interface View {
  x: Domain;
  y: Domain;
}
interface Drag {
  mode: Mode;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  start: View;
}
type Mode = "zoom" | "pan";

/**
 * The zoomed-out view. Short stints produce TS% of 0 or 125%, which would squash the
 * real pool into a sliver. So the scale spans every player with a real sample in full
 * (a 2001 Iverson must never be clipped), and only cameos past that range get pinned
 * to the edge, drawn hollow. Percentile trimming is the fallback when the slider lets
 * in nothing but cameos.
 *
 * TODO(you): what counts as "a real sample" is a judgment call. Higher bars give the crowd
 * more room but pin more bench players; lower bars let a 4-game hot streak set the scale.
 * Try it with both sliders at their minimum.
 */
const reliable = (p: RotationPlayer) => p.gp >= 10 && p.mpg >= 8;

function fullView(pool: RotationPlayer[]): View {
  if (!pool.length) return { x: [10, 40], y: [0.44, 0.72] };
  const core = pool.filter(reliable);
  const u = (core.length ? core : pool).map((p) => p.usg);
  const t = (core.length ? core : pool).map((p) => p.ts);
  const lo = core.length ? 0 : 0.02;
  const x = scaleLinear().domain([quantile(u, lo) - 1, quantile(u, 1 - lo) + 1]).nice().domain() as Domain;
  const y = scaleLinear().domain([quantile(t, lo) - 0.02, quantile(t, 1 - lo) + 0.02]).nice().domain() as Domain;
  return { x, y };
}

/** Just enough decimals to tell neighbouring ticks apart. `unit` is how much one displayed point is worth (0.01 for TS). */
const tickText = (ticks: number[], unit: number, f: (t: number, digits: number) => string) => {
  const step = (ticks.length > 1 ? ticks[1] - ticks[0] : unit) / unit;
  const digits = Math.max(0, Math.ceil(-Math.log10(step) - 1e-9));
  return (t: number) => f(t, digits);
};

export function UsageEfficiencyCard() {
  const meta = useMeta();
  const [season, setSeason] = useState(2024);
  const { data = [] } = useRotation(season);
  const [minGp, setMinGp] = useState(20);
  const [minMpg, setMinMpg] = useState(12);
  const [team, setTeam] = useState("");
  const [find, setFind] = useState("");
  const [mode, setMode] = useState<Mode>("zoom");
  const [view, setView] = useState<View | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tip = useChartTooltip();
  const dur = useDuration();
  const tr = useTransition();

  const pool = useMemo(() => data.filter((p) => p.gp >= minGp && p.mpg >= minMpg), [data, minGp, minMpg]);
  const full = useMemo(() => fullView(pool), [pool]);
  const cur: View = view ? { x: clampDomain(view.x, full.x), y: clampDomain(view.y, full.y) } : full;
  const zoomed = span(cur.x) < span(full.x) - 1e-9 || span(cur.y) < span(full.y) - 1e-9;
  const k = Math.min(span(full.x) / span(cur.x), span(full.y) / span(cur.y));

  const x = scaleLinear().domain(cur.x).range([L, W - R]);
  const y = scaleLinear().domain(cur.y).range([B, T]);
  const panning = drag?.mode === "pan";
  const moveDur = panning ? 0 : dur(0.5);

  const teams = useMemo(() => [...new Set(pool.map((p) => p.team))].sort(), [pool]);
  // A new season or filter can drop the focused team (no OKC in 2000) and the hovered dot.
  useEffect(() => {
    if (team && !teams.includes(team)) setTeam("");
    setHover(null);
    tip.hide();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool]);
  const findKey = key(find.trim());
  const focusOn = !!team || findKey.length > 1;
  const matches = useMemo(() => {
    if (!focusOn) return new Set<string>();
    return new Set(pool.filter((p) => (!team || p.team === team) && (findKey.length < 2 || key(p.name).includes(findKey))).map((p) => p.id));
  }, [pool, team, findKey, focusOn]);

  const { stars, meanU, meanT } = useMemo(
    () => ({
      stars: new Set([...pool].sort((a, b) => b.pts - a.pts).slice(0, 25).map((p) => p.id)),
      meanU: mean(pool.map((p) => p.usg)),
      meanT: mean(pool.map((p) => p.ts)),
    }),
    [pool],
  );

  // Screen positions. Off-scale players sit pinned to the edge of the full view.
  const pts = pool.map((p) => {
    const off = p.usg !== clamp(p.usg, full.x) || p.ts !== clamp(p.ts, full.y);
    return { p, off, cx: x(clamp(p.usg, full.x)), cy: y(clamp(p.ts, full.y)) };
  });
  const inView = (q: { cx: number; cy: number }) => q.cx >= L - 1 && q.cx <= W - R + 1 && q.cy >= T - 1 && q.cy <= B + 1;
  const visible = pts.filter(inView);
  // Draw order: crowd, then stars, then focus matches, so the interesting outlines sit on top.
  const rank = (id: string) => (matches.has(id) ? 2 : stars.has(id) ? 1 : 0);
  const ordered = [...pts].sort((a, b) => rank(a.p.id) - rank(b.p.id));

  const sel = pool.find((p) => p.id === selected) ?? null;
  const hov = pool.find((p) => p.id === hover) ?? null;
  const posOf = (p: RotationPlayer) => pts.find((q) => q.p.id === p.id)!;

  const maxLabels = focusOn ? 30 : Math.round(Math.min(40, 9 * k));
  const labels = useMemo(() => {
    const byPts = (a: (typeof visible)[number], b: (typeof visible)[number]) => b.p.pts - a.p.pts;
    const first = visible.filter((q) => q.p.id === selected);
    const focus = visible.filter((q) => matches.has(q.p.id) && q.p.id !== selected).sort(byPts);
    const starQ = visible.filter((q) => stars.has(q.p.id) && q.p.id !== selected && !matches.has(q.p.id)).sort((a, b) => b.p.bpm - a.p.bpm);
    const rest = k > 1.4 && !focusOn ? visible.filter((q) => !stars.has(q.p.id) && q.p.id !== selected).sort(byPts) : [];
    const order = [...first, ...focus, ...(focusOn ? [] : starQ), ...rest];
    return placeLabels(
      order.map((q) => ({ id: q.p.id, text: lastName(q.p.name), x: q.cx, y: q.cy, r: radius(q.p.mpg) })),
      maxLabels,
      { w: W - R, h: H },
    );
    // `visible` is rebuilt every render; the inputs below are what it depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool, cur.x[0], cur.x[1], cur.y[0], cur.y[1], selected, matches, stars, maxLabels, focusOn, k]);

  // ---- pointer handling: one overlay rect owns hover, click, brush and pan ----
  const toSvg = (e: { clientX: number; clientY: number }) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * W) / r.width, y: ((e.clientY - r.top) * H) / r.height };
  };
  const within = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

  const onDown = (e: RPointerEvent<SVGRectElement>) => {
    if (e.button !== 0) return;
    const p = toSvg(e);
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ mode, x0: p.x, y0: p.y, x1: p.x, y1: p.y, start: cur });
  };

  const onMove = (e: RPointerEvent<SVGRectElement>) => {
    const p = toSvg(e);
    if (drag) {
      const next = { ...drag, x1: within(p.x, L, W - R), y1: within(p.y, T, B) };
      setDrag(next);
      if (drag.mode === "pan") {
        const sx = scaleLinear().domain(drag.start.x).range([L, W - R]);
        const sy = scaleLinear().domain(drag.start.y).range([B, T]);
        setView({
          x: panBy(drag.start.x, sx.invert(drag.x0) - sx.invert(p.x), full.x),
          y: panBy(drag.start.y, sy.invert(drag.y0) - sy.invert(p.y), full.y),
        });
      }
      tip.hide();
      return;
    }
    const i = nearest(visible.map((q) => ({ x: q.cx, y: q.cy })), p.x, p.y, HOVER_PX);
    const q = i >= 0 ? visible[i] : null;
    setHover(q?.p.id ?? null);
    if (q) tip.show(e, tipFor(q.p, q.off));
    else tip.hide();
  };

  const onUp = (e: RPointerEvent<SVGRectElement>) => {
    if (!drag) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    const dx = Math.abs(drag.x1 - drag.x0);
    const dy = Math.abs(drag.y1 - drag.y0);
    setDrag(null);
    if (drag.mode === "zoom" && dx > 8 && dy > 8) {
      const nx: Domain = [x.invert(Math.min(drag.x0, drag.x1)), x.invert(Math.max(drag.x0, drag.x1))];
      const ny: Domain = [y.invert(Math.max(drag.y0, drag.y1)), y.invert(Math.min(drag.y0, drag.y1))];
      const grow = (d: Domain, m: number): Domain => (span(d) >= m ? d : [(d[0] + d[1]) / 2 - m / 2, (d[0] + d[1]) / 2 + m / 2]);
      setView({ x: clampDomain(grow(nx, MIN_SPAN.x), full.x), y: clampDomain(grow(ny, MIN_SPAN.y), full.y) });
      return;
    }
    if (dx < 4 && dy < 4) setSelected(hover && hover !== selected ? hover : null);
  };

  const zoomBy = (factor: number, at?: { x: number; y: number }) => {
    const ax = at ? x.invert(at.x) : (cur.x[0] + cur.x[1]) / 2;
    const ay = at ? y.invert(at.y) : (cur.y[0] + cur.y[1]) / 2;
    setView({ x: zoomAround(cur.x, ax, factor, full.x, MIN_SPAN.x), y: zoomAround(cur.y, ay, factor, full.y, MIN_SPAN.y) });
  };

  // Pinch / ctrl-scroll zooms. Plain scroll stays with the page. React's wheel listener is
  // passive, so preventDefault needs a native one.
  const zoomRef = useRef(zoomBy);
  zoomRef.current = zoomBy;
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomRef.current(Math.exp(e.deltaY * 0.01), { x: ((e.clientX - r.left) * W) / r.width, y: ((e.clientY - r.top) * H) / r.height });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const focusPlayer = (p: RotationPlayer) => {
    setSelected(p.id);
    const q = posOf(p);
    if (!inView(q)) {
      const cx = clamp(p.usg, full.x);
      const cy = clamp(p.ts, full.y);
      setView({ x: panBy(cur.x, cx - (cur.x[0] + cur.x[1]) / 2, full.x), y: panBy(cur.y, cy - (cur.y[0] + cur.y[1]) / 2, full.y) });
    }
  };

  const seasons = meta.data ? range(...meta.data.seasons) : [season];
  const pools = useMemo(
    () => ({ usg: pool.map((p) => p.usg), ts: pool.map((p) => p.ts), bpm: pool.map((p) => p.bpm), mpg: pool.map((p) => p.mpg) }),
    [pool],
  );

  const tipFor = (p: RotationPlayer, off = false) => (
    <Tip
      title={p.name}
      rows={[
        ["Team", p.team],
        ["Usage", `${num(p.usg)}%`],
        ["TS%", pct(p.ts)],
        ["BPM", signed(p.bpm)],
        ["MPG · GP", `${num(p.mpg)} · ${p.gp}`],
        ...(off ? ([["", "Off the scale: pinned to the edge"]] as [string, string][]) : []),
      ]}
    />
  );

  const xt = x.ticks(10);
  const yt = y.ticks(8);
  const xFmt = tickText(xt, 1, (t, d) => `${num(t, d)}%`);
  const yFmt = tickText(yt, 0.01, (t, d) => pct(t, d));
  const brush = drag?.mode === "zoom" ? drag : null;
  const inViewList = [...visible].sort((a, b) => b.p.pts - a.p.pts);
  const listSrc = focusOn ? inViewList.filter((q) => matches.has(q.p.id)) : inViewList;

  return (
    <Card
      id="1c"
      wide
      caption="Usage against true shooting for every player in a season, with zoom, focus and a games filter"
      kicker="Rotation players · int_player_performance"
      title="Who carries the load, and who makes it count"
      sub={`${seasonLabel(season)} · ${pool.length} of ${data.length} players with ${minGp}+ games and ${minMpg}+ minutes · color is BPM, size is minutes`}
      controls={<SeasonSlider value={season} onChange={setSeason} seasons={seasons} />}
      onMouseLeave={() => setHover(null)}
    >
      <div className="ue-toolbar">
        <label className="ue-range">
          <span className="tile-label">Min games</span>
          <input type="range" min={1} max={82} value={minGp} onChange={(e) => setMinGp(Number(e.target.value))} aria-label="Minimum games played" />
          <span className="num ue-range-val">{minGp}</span>
        </label>
        <label className="ue-range">
          <span className="tile-label">Min MPG</span>
          <input type="range" min={0} max={36} value={minMpg} onChange={(e) => setMinMpg(Number(e.target.value))} aria-label="Minimum minutes per game" />
          <span className="num ue-range-val">{minMpg}</span>
        </label>
        <select className="pill-select" value={team} onChange={(e) => setTeam(e.target.value)} aria-label="Focus a team">
          <option value="">All teams</option>
          {teams.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <div className="search-box" style={{ width: 190 }}>
          <Search size={14} strokeWidth={2.75} color="#645c50" style={{ flex: "none" }} aria-hidden />
          <input
            value={find}
            onChange={(e) => setFind(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && listSrc[0]) focusPlayer(listSrc[0].p);
              if (e.key === "Escape") setFind("");
            }}
            placeholder="Highlight players"
            aria-label="Highlight players by name"
            spellCheck={false}
          />
        </div>
        <div className="row" style={{ gap: 6, marginLeft: "auto" }}>
          <Segmented
            options={[
              { value: "zoom", label: "Drag to zoom" },
              { value: "pan", label: "Drag to pan" },
            ]}
            value={mode}
            onChange={setMode}
            label="Drag mode"
            size="sm"
          />
          <button type="button" className="icon-btn" aria-label="Zoom in" onClick={() => zoomBy(0.6)} disabled={k > 12}>
            <ZoomIn size={15} strokeWidth={2.75} />
          </button>
          <button type="button" className="icon-btn" aria-label="Zoom out" onClick={() => zoomBy(1 / 0.6)} disabled={!zoomed}>
            <ZoomOut size={15} strokeWidth={2.75} />
          </button>
          <button type="button" className="icon-btn" aria-label="Reset zoom" onClick={() => setView(null)} disabled={!zoomed}>
            <Maximize2 size={14} strokeWidth={2.75} />
          </button>
        </div>
      </div>

      <div className="ue-grid">
        <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
          <Plot
            w={W}
            h={H}
            svgProps={{ "aria-label": "Usage rate against true shooting percentage", ref: svgRef, style: { touchAction: "none" } }}
            labels={
              <>
                {xt.map((t) => (
                  <Lab key={`x${t}`} x={x(t)} y={B + 10} w={W} h={H} ax="middle" ay="top" className="tick">
                    {xFmt(t)}
                  </Lab>
                ))}
                {yt.map((t) => (
                  <Lab key={`y${t}`} x={L - 6} y={y(t)} w={W} h={H} ax="end" className="tick">
                    {yFmt(t)}
                  </Lab>
                ))}
                <Lab x={W - R} y={B - 6} w={W} h={H} ax="end" ay="bottom" className="axis-title">
                  Usage rate →
                </Lab>
                <Lab x={L + 6} y={T + 4} w={W} h={H} ay="top" className="axis-title">
                  ↑ True shooting %
                </Lab>
                {!zoomed && (
                  <>
                    <Lab x={W - R - 8} y={T + 8} w={W} h={H} ax="end" ay="top" className="axis-title" style={{ color: "#8c491a" }}>
                      High load · efficient
                    </Lab>
                    <Lab x={L + 8} y={B - 22} w={W} h={H} ay="bottom" className="axis-title" style={{ color: "#56633f" }}>
                      Low load · inefficient
                    </Lab>
                  </>
                )}
                {labels.map((l) => (
                  <Lab
                    key={l.id}
                    x={l.left}
                    y={l.top + l.height / 2}
                    w={W}
                    h={H}
                    halo
                    style={{
                      fontSize: 11,
                      fontWeight: l.id === selected || matches.has(l.id) ? 800 : 700,
                      color: l.id === selected ? "#8c491a" : "#2e2b25",
                      pointerEvents: "none",
                      transition: panning ? "none" : tr("left, top", 0.5),
                    }}
                  >
                    {l.text}
                  </Lab>
                ))}
                {hov && !drag && (
                  <>
                    <Lab x={posOf(hov).cx} y={B + 24} w={W} h={H} ax="middle" ay="top" className="ue-axis-chip num">
                      {num(hov.usg)}%
                    </Lab>
                    <Lab x={L - 6} y={posOf(hov).cy} w={W} h={H} ax="end" className="ue-axis-chip num" style={{ marginLeft: -26 }}>
                      {pct(hov.ts)}
                    </Lab>
                  </>
                )}
              </>
            }
          >
            <defs>
              <clipPath id="ue-clip">
                <rect x={L - CLIP_PAD} y={T - CLIP_PAD} width={W - R - L + 2 * CLIP_PAD} height={B - T + 2 * CLIP_PAD} />
              </clipPath>
            </defs>
            {xt.map((t) => (
              <line key={`gx${t}`} x1={x(t)} x2={x(t)} y1={T} y2={B} stroke="rgba(32,30,29,.05)" />
            ))}
            {yt.map((t) => (
              <line key={`gy${t}`} x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="rgba(32,30,29,.05)" />
            ))}
            <g clipPath="url(#ue-clip)">
              {pool.length > 0 && (
                <>
                  <rect
                    x={x(meanU)}
                    y={y(cur.y[1]) - 40}
                    width={Math.max(0, W - R - x(meanU) + 40)}
                    height={Math.max(0, y(meanT) - y(cur.y[1]) + 40)}
                    rx={18}
                    fill="#f5ead8"
                    style={{ transition: panning ? "none" : tr("x, y, width, height", 0.5) }}
                  />
                  <line x1={x(meanU)} x2={x(meanU)} y1={T - 20} y2={B + 20} stroke="#a19786" strokeDasharray="4 4" />
                  <line x1={L - 20} x2={W - R + 20} y1={y(meanT)} y2={y(meanT)} stroke="#a19786" strokeDasharray="4 4" />
                </>
              )}
              <AnimatePresence initial={false}>
                {ordered.map(({ p, cx, cy, off }) => {
                  const star = stars.has(p.id);
                  const match = matches.has(p.id);
                  const dim = focusOn && !match;
                  const r = radius(p.mpg);
                  const fill = diverging(p.bpm, 7);
                  return (
                    <motion.circle
                      key={p.id}
                      initial={{ opacity: 0, cx, cy, r }}
                      animate={{ opacity: dim ? 0.13 : 1, cx, cy, r }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: moveDur, ease: EASE, opacity: { duration: dur(0.3) } }}
                      fill={off ? "#fbf7f0" : fill}
                      stroke={off ? fill : match || star ? "#2e2b25" : "#fbf7f0"}
                      strokeOpacity={off || match || star ? 1 : 0.88}
                      strokeWidth={off ? 2 : match ? 2 : star ? 1.6 : 1}
                      pointerEvents="none"
                    />
                  );
                })}
              </AnimatePresence>
              {hov && !drag && (
                <g pointerEvents="none">
                  <line x1={posOf(hov).cx} x2={posOf(hov).cx} y1={posOf(hov).cy} y2={B + CLIP_PAD} stroke="#2e2b25" strokeOpacity={0.35} strokeDasharray="2 3" />
                  <line x1={L - CLIP_PAD} x2={posOf(hov).cx} y1={posOf(hov).cy} y2={posOf(hov).cy} stroke="#2e2b25" strokeOpacity={0.35} strokeDasharray="2 3" />
                  <circle cx={posOf(hov).cx} cy={posOf(hov).cy} r={radius(hov.mpg) + 4} fill="none" stroke="#2e2b25" strokeWidth={1.5} />
                </g>
              )}
              {sel && (
                <motion.circle
                  key="ring"
                  animate={{ cx: posOf(sel).cx, cy: posOf(sel).cy, r: radius(sel.mpg) + 5 }}
                  transition={{ duration: moveDur, ease: EASE }}
                  fill="none"
                  stroke="#c67139"
                  strokeWidth={2.5}
                  pointerEvents="none"
                />
              )}
            </g>
            <line x1={L} x2={W - R} y1={B} y2={B} stroke="rgba(32,30,29,.16)" />
            {brush && (
              <rect
                x={Math.min(brush.x0, brush.x1)}
                y={Math.min(brush.y0, brush.y1)}
                width={Math.abs(brush.x1 - brush.x0)}
                height={Math.abs(brush.y1 - brush.y0)}
                rx={6}
                fill="rgba(198,113,57,.1)"
                stroke="#c67139"
                strokeDasharray="4 3"
                pointerEvents="none"
              />
            )}
            <rect
              x={L - CLIP_PAD}
              y={T - CLIP_PAD}
              width={W - R - L + 2 * CLIP_PAD}
              height={B - T + 2 * CLIP_PAD}
              fill="transparent"
              style={{ cursor: drag ? (drag.mode === "pan" ? "grabbing" : "crosshair") : hover ? "pointer" : mode === "pan" ? "grab" : "crosshair" }}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={() => setDrag(null)}
              onPointerLeave={() => {
                if (!drag) {
                  setHover(null);
                  tip.hide();
                }
              }}
            />
          </Plot>
          <div className="note">
            Drag a box to zoom, switch to pan to move around, pinch or ⌘/Ctrl + scroll to zoom at the cursor. Hover snaps to the nearest player;
            click to pin one. Hollow dots are off the scale and pinned to the edge.
          </div>
        </div>

        <aside className="ue-side">
          <Overview pool={pool} full={full} cur={cur} zoomed={zoomed} matches={matches} focusOn={focusOn} selected={selected} onJump={(c) => setView(c)} />

          <div className="tile" style={{ gap: 10, minHeight: 120 }}>
            {sel ? (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontFamily: "var(--font-heading)", fontSize: 19, lineHeight: 1.1 }}>{sel.name}</span>
                  <span className="num" style={{ fontSize: 11, color: "#645c50" }}>
                    {sel.team} · {sel.gp} GP · {num(sel.mpg)} MPG · {num(sel.pts)} PPG
                  </span>
                </div>
                {(
                  [
                    ["Usage", percentile(sel.usg, pools.usg), `${num(sel.usg)}%`],
                    ["True shooting", percentile(sel.ts, pools.ts), pct(sel.ts)],
                    ["BPM", percentile(sel.bpm, pools.bpm), signed(sel.bpm)],
                    ["Minutes", percentile(sel.mpg, pools.mpg), num(sel.mpg)],
                  ] as const
                ).map(([label, v, raw]) => (
                  <div key={label} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "#645c50" }}>
                      <span>
                        {label} <b className="num" style={{ color: "#2e2b25" }}>{raw}</b>
                      </span>
                      <span className="num" style={{ fontWeight: 700, color: "#2e2b25" }}>
                        {Math.round(v * 100)}th
                      </span>
                    </div>
                    <div style={{ height: 7, borderRadius: 999, background: "#e3d8c6", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${v * 100}%`, background: "#7a8a5e", borderRadius: 999, transition: tr("width", 0.5) }} />
                    </div>
                  </div>
                ))}
                <span className="note">Percentiles are within the {pool.length} players that pass the filters.</span>
              </>
            ) : (
              <div className="note" style={{ margin: "auto 0" }}>
                Click a dot or a name to pin a player and see where they rank. Outlined dots are the top 25 scorers in the filtered pool.
              </div>
            )}
          </div>

          <div className="tile" style={{ gap: 6, padding: "12px 8px 8px" }}>
            <div className="row" style={{ justifyContent: "space-between", padding: "0 6px" }}>
              <span className="tile-label">{focusOn ? "Highlighted" : zoomed ? "In view" : "All players"}, by points</span>
              <span className="num tile-sub">{listSrc.length}</span>
            </div>
            <ul className="ue-list">
              {listSrc.slice(0, 40).map(({ p }) => (
                <li key={p.id}>
                  <button
                    type="button"
                    data-on={p.id === selected}
                    data-hot={p.id === hover}
                    onMouseEnter={() => setHover(p.id)}
                    onMouseLeave={() => setHover(null)}
                    onClick={() => (p.id === selected ? setSelected(null) : focusPlayer(p))}
                  >
                    <span className="dot" style={{ background: diverging(p.bpm, 7) }} />
                    <span className="ue-list-name">{p.name}</span>
                    <span className="num ue-list-meta">
                      {p.team} · {num(p.pts)}
                    </span>
                  </button>
                </li>
              ))}
              {listSrc.length === 0 && <li className="note" style={{ padding: "4px 6px" }}>No players here. Zoom out or loosen the filters.</li>}
            </ul>
          </div>
        </aside>
      </div>
      {tip.node}
    </Card>
  );
}

const OW = 270;
const OH = 150;

/** Whole-pool overview with the current viewport; click to move the viewport there. */
function Overview({
  pool,
  full,
  cur,
  zoomed,
  matches,
  focusOn,
  selected,
  onJump,
}: {
  pool: RotationPlayer[];
  full: View;
  cur: View;
  zoomed: boolean;
  matches: Set<string>;
  focusOn: boolean;
  selected: string | null;
  onJump: (v: View) => void;
}) {
  const ox: ScaleLinear<number, number> = scaleLinear().domain(full.x).range([4, OW - 4]);
  const oy: ScaleLinear<number, number> = scaleLinear().domain(full.y).range([OH - 4, 4]);
  const jump = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!zoomed) return;
    const r = e.currentTarget.getBoundingClientRect();
    const vx = ox.invert(((e.clientX - r.left) * OW) / r.width);
    const vy = oy.invert(((e.clientY - r.top) * OH) / r.height);
    onJump({
      x: panBy(cur.x, vx - (cur.x[0] + cur.x[1]) / 2, full.x),
      y: panBy(cur.y, vy - (cur.y[0] + cur.y[1]) / 2, full.y),
    });
  };
  return (
    <div className="tile" style={{ gap: 6 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="tile-label">Overview</span>
        <span className="tile-sub">{zoomed ? "click to move the view" : "drag on the chart to zoom"}</span>
      </div>
      <svg viewBox={`0 0 ${OW} ${OH}`} style={{ width: "100%", height: "auto", display: "block", cursor: zoomed ? "pointer" : "default" }} onClick={jump} role="img" aria-label="Overview of all players">
        {pool.map((p) => {
          const on = !focusOn || matches.has(p.id);
          return (
            <circle
              key={p.id}
              cx={ox(clamp(p.usg, full.x))}
              cy={oy(clamp(p.ts, full.y))}
              r={p.id === selected ? 3.2 : 1.7}
              fill={p.id === selected ? "#c67139" : on ? diverging(p.bpm, 7) : "#d4cab9"}
              opacity={on ? 0.9 : 0.6}
            />
          );
        })}
        {zoomed && (
          <rect
            x={ox(cur.x[0])}
            y={oy(cur.y[1])}
            width={ox(cur.x[1]) - ox(cur.x[0])}
            height={oy(cur.y[0]) - oy(cur.y[1])}
            rx={4}
            fill="rgba(198,113,57,.08)"
            stroke="#c67139"
            strokeWidth={1.5}
          />
        )}
      </svg>
    </div>
  );
}
