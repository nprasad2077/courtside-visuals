import { useState } from "react";
import { Card } from "../components/Card";
import { range, SeasonSlider } from "../components/SeasonSlider";
import { TeamSelect } from "../components/TeamSelect";
import { useH2H, useMeta, useTeamSeason, type TeamSeason } from "../lib/api";
import { isDark } from "../lib/color";
import { num, pct, shortDate, signed } from "../lib/format";
import { useTransition } from "../lib/motion";

type Key = "efg" | "tov" | "orb" | "ftr" | "ortg" | "drtg" | "net" | "pace";
const ROWS: { key: Key; label: string; span: number; lowerBetter?: boolean; neutral?: boolean; fmt: (v: number) => string }[] = [
  { key: "efg", label: "eFG%", span: 0.05, fmt: (v) => pct(v) },
  { key: "tov", label: "TOV%", span: 0.025, lowerBetter: true, fmt: (v) => pct(v) },
  { key: "orb", label: "OREB%", span: 0.05, fmt: (v) => pct(v) },
  { key: "ftr", label: "FT rate", span: 0.07, fmt: (v) => num(v, 3).replace(/^0/, "") },
  { key: "ortg", label: "ORtg", span: 8, fmt: (v) => num(v) },
  { key: "drtg", label: "DRtg", span: 8, lowerBetter: true, fmt: (v) => num(v) },
  { key: "net", label: "Net", span: 14, fmt: (v) => signed(v) },
  { key: "pace", label: "Pace", span: 5, neutral: true, fmt: (v) => num(v) },
];

const clamp = (v: number) => Math.max(-1, Math.min(1, v));
const confName = (c: "E" | "W") => (c === "E" ? "East" : "West");

function TeamHead({ t, abbr, align }: { t: TeamSeason | undefined; abbr: string; align: "left" | "right" }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: align === "right" ? "flex-end" : "flex-start", minWidth: 0 }}>
      <span className="num" style={{ fontFamily: "var(--font-heading)", fontSize: 30, lineHeight: 1, color: t?.color ?? "#2e2b25" }}>
        {t ? `${t.w}–${t.l}` : "—"}
      </span>
      <span className="num" style={{ fontSize: 11.5, color: "#645c50" }}>
        {t ? `${t.name} · #${t.seed} ${confName(t.conf)} · ${signed(t.net)} net` : `${abbr} didn't play this season`}
      </span>
    </div>
  );
}

function Tags({ t, align }: { t: TeamSeason | undefined; align: "left" | "right" }) {
  if (!t) return <div />;
  const tags = [t.offensive_tier, t.defensive_tier, t.shot_selection_style, t.ball_movement_style, t.ball_security_tier].filter(Boolean);
  return (
    <div className="row" style={{ gap: 5, justifyContent: align === "right" ? "flex-end" : "flex-start" }}>
      {tags.map((x) => (
        <span key={x} className="tag-pill" style={{ background: "#eee7db", color: "#474238", fontSize: 10.5 }}>
          {x}
        </span>
      ))}
    </div>
  );
}

export function TeamVsTeamCard() {
  const meta = useMeta();
  const [a, setA] = useState("BOS");
  const [b, setB] = useState("LAL");
  const [season, setSeason] = useState(2007);
  const teams = useTeamSeason(season).data ?? [];
  const h2h = useH2H(a, b, season).data ?? [];
  const tr = useTransition();
  const ta = teams.find((t) => t.abbr === a);
  const tb = teams.find((t) => t.abbr === b);
  const seasons = meta.data ? range(...meta.data.seasons) : [season];
  const colorB = tb && ta && tb.color.toLowerCase() === ta.color.toLowerCase() ? "#7a8a5e" : tb?.color;
  const winsA = h2h.filter((g) => g.winner === a).length;

  return (
    <Card
      id="1e"
      width={620}
      caption="Two teams' four factors and ratings as a tug of war"
      kicker="Team vs team · int_team_performance"
      title="Where the edge comes from"
      sub="The knob slides toward the team that's better on each row"
      controls={<SeasonSlider value={season} onChange={setSeason} seasons={seasons} />}
    >
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
          <TeamSelect value={a} onChange={setA} label="Team A" />
          <TeamHead t={ta} abbr={a} align="left" />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end", minWidth: 0 }}>
          <TeamSelect value={b} onChange={setB} label="Team B" />
          <TeamHead t={tb} abbr={b} align="right" />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "52px minmax(0,1fr) 52px", rowGap: 10, columnGap: 10, alignItems: "center" }}>
        {ROWS.map((r) => {
          const va = ta?.[r.key];
          const vb = tb?.[r.key];
          const ok = va != null && vb != null;
          const adv = ok ? clamp(((va - vb) / r.span) * (r.lowerBetter ? -1 : 1)) : 0;
          const lead = adv > 0 ? ta : adv < 0 ? tb : undefined;
          const fill = r.neutral ? "#a19786" : lead === ta ? ta?.color : colorB;
          const knob = 50 - adv * 44;
          return (
            <div key={r.key} style={{ display: "contents" }}>
              <span className="num" style={{ fontSize: 12, fontWeight: adv > 0 && !r.neutral ? 800 : 500 }}>
                {ok ? r.fmt(va) : "—"}
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, fontWeight: 700, color: "#474238" }}>
                  <span>{r.label}</span>
                  <span style={{ color: "#82796a", fontWeight: 500 }}>{r.neutral ? "toward faster" : r.lowerBetter ? "lower is better" : ""}</span>
                </div>
                <div style={{ position: "relative", height: 12, borderRadius: 999, background: "#eee7db" }}>
                  <div style={{ position: "absolute", left: "50%", top: -3, bottom: -3, width: 2, marginLeft: -1, background: "#c0b6a5" }} />
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      bottom: 0,
                      left: `${Math.min(50, knob)}%`,
                      width: `${Math.abs(50 - knob)}%`,
                      background: fill ?? "#c0b6a5",
                      borderRadius: 999,
                      transition: tr("left, width, background", 0.6),
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      top: -3,
                      left: `${knob}%`,
                      width: 18,
                      height: 18,
                      marginLeft: -9,
                      borderRadius: "50%",
                      border: "3px solid #fbf7f0",
                      boxSizing: "border-box",
                      background: fill ?? "#c0b6a5",
                      boxShadow: "0 1px 2px rgba(46,43,37,.2)",
                      transition: tr("left, background", 0.6),
                    }}
                  />
                </div>
              </div>
              <span className="num" style={{ fontSize: 12, textAlign: "right", fontWeight: adv < 0 && !r.neutral ? 800 : 500 }}>
                {ok ? r.fmt(vb) : "—"}
              </span>
            </div>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 12 }}>
        <Tags t={ta} align="left" />
        <Tags t={tb} align="right" />
      </div>

      <div className="tile" style={{ gap: 8 }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span className="tile-label">Head to head this season</span>
          {h2h.length > 0 && (
            <span className="num" style={{ fontSize: 12, fontWeight: 800 }}>
              {winsA >= h2h.length - winsA ? `${a} ${winsA}–${h2h.length - winsA}` : `${b} ${h2h.length - winsA}–${winsA}`}
            </span>
          )}
        </div>
        {h2h.length ? (
          <div className="row" style={{ gap: 6 }}>
            {h2h.map((g) => {
              const bg = g.winner === a ? (ta?.color ?? "#c67139") : (colorB ?? "#7a8a5e");
              return (
                <span key={g.date} className="tag-pill num" style={{ background: bg, color: isDark(bg) ? "#fbf7f0" : "#2e2b25", gap: 6 }}>
                  <b>
                    {g.aPts}–{g.bPts}
                  </b>
                  <span style={{ opacity: 0.85 }}>
                    {g.home ? "vs" : "@"} {b} · {shortDate(g.date)}
                  </span>
                </span>
              );
            })}
          </div>
        ) : (
          <span className="note">{a === b ? "Pick two different teams." : "They didn't meet in the regular season."}</span>
        )}
      </div>
    </Card>
  );
}
