import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Card } from "../components/Card";
import { Tip, useChartTooltip } from "../components/ChartTooltip";
import { PlayerSearch } from "../components/PlayerSearch";
import { SeasonSlider } from "../components/SeasonSlider";
import { useGameLog, useSeasonFor, type GameRow } from "../lib/api";
import { dateLabel, num, pct, signed } from "../lib/format";
import { useTransition } from "../lib/motion";
import { mean } from "../lib/stats";

const DEFAULT = { id: "curryst01", name: "Stephen Curry" };

const best = (games: GameRow[]) =>
  games.reduce((b, g, i) => (g.points + g.total_rebounds + g.assists > games[b].points + games[b].total_rebounds + games[b].assists ? i : b), 0);

const score = (g: GameRow) => {
  const home = g.team_location === "HOME";
  const own = home ? g.home_points : g.visitor_points;
  const opp = home ? g.visitor_points : g.home_points;
  return `${own}–${opp}`;
};

interface Adv {
  key: keyof GameRow;
  label: string;
  lo: number;
  hi: number;
  fmt: (v: number) => string;
  lowerBetter?: boolean;
}

const ADV: Adv[] = [
  { key: "true_shooting_pct", label: "TS%", lo: 0.35, hi: 0.9, fmt: (v) => pct(v) },
  { key: "effective_fg_pct", label: "eFG%", lo: 0.3, hi: 0.85, fmt: (v) => pct(v) },
  { key: "usage_pct", label: "USG%", lo: 10, hi: 48, fmt: (v) => num(v) },
  { key: "offensive_rating", label: "ORtg", lo: 80, hi: 165, fmt: (v) => num(v, 0) },
  { key: "defensive_rating", label: "DRtg", lo: 88, hi: 140, fmt: (v) => num(v, 0), lowerBetter: true },
  { key: "box_plus_minus", label: "BPM", lo: -15, hi: 22, fmt: (v) => signed(v) },
];

const at = (v: number, lo: number, hi: number) => `${Math.min(100, Math.max(0, ((v - lo) / (hi - lo)) * 100))}%`;

export function BoxScoreCard() {
  const [player, setPlayer] = useState(DEFAULT);
  const { season, setSeason, seasons } = useSeasonFor(player.id, { initial: 2015 });
  const log = useGameLog(player.id, season);
  const games = useMemo(() => log.data ?? [], [log.data]);
  const [idx, setIdx] = useState<number | null>(null);
  const tip = useChartTooltip();
  const tr = useTransition();

  // A new game log opens on its best game.
  useEffect(() => {
    if (!log.isPlaceholderData && games.length) setIdx(best(games));
  }, [games, log.isPlaceholderData]);

  const i = idx != null && idx < games.length ? idx : 0;
  const g = games[i];
  const avg = useMemo(() => {
    const m = (k: keyof GameRow) => mean(games.map((r) => r[k]).filter((v): v is number => typeof v === "number"));
    return Object.fromEntries(
      (["points", "total_rebounds", "assists", ...ADV.map((a) => a.key)] as (keyof GameRow)[]).map((k) => [k, m(k)]),
    ) as Record<string, number>;
  }, [games]);
  const maxPts = Math.max(1, ...games.map((r) => r.points));

  const tags: { text: string; bg: string; fg: string }[] = [];
  if (g) {
    if (g.is_triple_double) tags.push({ text: "Triple-double", bg: "#c67139", fg: "#fbf7f0" });
    else if (g.is_double_double) tags.push({ text: "Double-double", bg: "#c67139", fg: "#fbf7f0" });
    if (g.usage_tier && g.usage_tier !== "Insufficient Minutes") tags.push({ text: g.usage_tier, bg: "#ffe1d0", fg: "#643312" });
    if (g.impact_tier) tags.push({ text: g.impact_tier, bg: "#e1eecc", fg: "#3d472b" });
    if (g.shooting_efficiency_tier) tags.push({ text: `${g.shooting_efficiency_tier} efficiency`, bg: "#eee7db", fg: "#474238" });
    if (g.minutes_based_role) tags.push({ text: g.minutes_based_role, bg: "#eee7db", fg: "#474238" });
    if (g.is_versatile) tags.push({ text: "Versatile", bg: "#eee7db", fg: "#474238" });
    if (g.is_three_and_d) tags.push({ text: "3-and-D", bg: "#eee7db", fg: "#474238" });
    if (g.is_defensive_specialist) tags.push({ text: "Defensive specialist", bg: "#eee7db", fg: "#474238" });
  }

  return (
    <Card
      id="1b"
      width={580}
      caption="One game's box score as a ticket, set against the player's season"
      kicker="Single game · int_player_performance"
      title={
        g ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 26 }}>{player.name}</span>
            <span className="tag-pill" style={{ background: g.game_result === "W" ? "#7a8a5e" : "#a19786", color: "#fff", fontFamily: "var(--font-body)" }}>
              {g.game_result} {score(g)}
            </span>
          </span>
        ) : (
          player.name
        )
      }
      sub={g ? `${g.team} ${g.team_location === "HOME" ? "vs" : "@"} ${g.opponent} · ${dateLabel(g.game_date)}` : " "}
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
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 1.5, height: 42 }} onMouseLeave={tip.hide}>
          {games.map((r, k) => (
            <button
              key={r.game_id}
              type="button"
              aria-label={`Game ${k + 1} vs ${r.opponent}, ${r.points} points`}
              onClick={() => setIdx(k)}
              onMouseMove={(e) =>
                tip.show(
                  e,
                  <Tip
                    title={`G${k + 1} · ${r.team_location === "HOME" ? "vs" : "@"} ${r.opponent}`}
                    rows={[
                      ["Result", `${r.game_result} ${score(r)}`],
                      ["PTS / REB / AST", `${r.points} / ${r.total_rebounds} / ${r.assists}`],
                      ["TS%", r.true_shooting_pct != null ? pct(r.true_shooting_pct) : "—"],
                    ]}
                  />,
                )
              }
              style={{
                flex: "1 1 0",
                minWidth: 0,
                padding: 0,
                border: 0,
                cursor: "pointer",
                borderRadius: "3px 3px 1px 1px",
                height: `${Math.max(6, (r.points / maxPts) * 100)}%`,
                background: k === i ? "#c67139" : r.game_result === "W" ? "#aebf92" : "#dcd3c4",
                transition: tr("height, background", 0.5),
              }}
            />
          ))}
        </div>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div className="row" style={{ gap: 6 }}>
            <button type="button" className="icon-btn" aria-label="Previous game" disabled={i <= 0} onClick={() => setIdx(i - 1)}>
              <ChevronLeft size={14} strokeWidth={2.75} />
            </button>
            <button
              type="button"
              className="icon-btn"
              style={{ width: "auto", padding: "0 12px", gap: 6, whiteSpace: "nowrap", fontSize: 11.5, fontWeight: 700 }}
              onClick={() => games.length && setIdx(best(games))}
            >
              <Star size={12} strokeWidth={2.75} /> Best game
            </button>
            <button type="button" className="icon-btn" aria-label="Next game" disabled={i >= games.length - 1} onClick={() => setIdx(i + 1)}>
              <ChevronRight size={14} strokeWidth={2.75} />
            </button>
          </div>
          <span className="num" style={{ fontSize: 11.5, color: "#645c50", minWidth: 90, textAlign: "right" }}>
            {games.length ? `Game ${i + 1} of ${games.length}` : "—"}
          </span>
        </div>
      </div>

      {g && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 10 }}>
            {(
              [
                ["PTS", g.points, avg.points],
                ["REB", g.total_rebounds, avg.total_rebounds],
                ["AST", g.assists, avg.assists],
              ] as const
            ).map(([k, v, a]) => (
              <div className="tile" key={k} style={{ padding: "14px 16px" }}>
                <div className="tile-label">{k}</div>
                <div className="num" style={{ fontFamily: "var(--font-heading)", fontSize: 48, lineHeight: 1 }}>
                  {v}
                </div>
                <div className="tile-sub">
                  avg {num(a)} ·{" "}
                  <b style={{ color: v - a >= 0 ? "#8c491a" : "#56633f" }}>{signed(v - a)}</b>
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(8, minmax(0,1fr))",
              border: "1px solid rgba(32,30,29,.16)",
              borderRadius: 16,
              overflow: "hidden",
            }}
          >
            {(
              [
                ["MIN", num(g.minutes_played, 0)],
                ["FG", `${g.field_goals_made}-${g.field_goals_attempted}`],
                ["3P", `${g.three_pointers_made}-${g.three_pointers_attempted}`],
                ["STL", g.steals],
                ["BLK", g.blocks],
                ["TOV", g.turnovers],
                ["+/−", signed(g.plus_minus, 0)],
                ["BPM", signed(g.box_plus_minus)],
              ] as const
            ).map(([k, v], n) => (
              <div key={k} style={{ padding: "8px 4px", textAlign: "center", borderLeft: n ? "1px solid rgba(32,30,29,.1)" : 0, minWidth: 0 }}>
                <div className="tile-label" style={{ fontSize: 9 }}>
                  {k}
                </div>
                <div className="num" style={{ fontWeight: 700, fontSize: 13.5, marginTop: 3 }}>
                  {v}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {ADV.map((a) => {
              const v = g[a.key] as number | null;
              const s = avg[a.key as string];
              const d = v != null ? (v - s) * (a.lowerBetter ? -1 : 1) : 0;
              const scale = a.lo < 1 && a.hi <= 1 ? 100 : 1;
              return (
                <div key={a.label} style={{ display: "grid", gridTemplateColumns: "44px minmax(0,1fr) 46px 48px", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#474238" }}>{a.label}</span>
                  <div style={{ position: "relative", height: 14, borderRadius: 999, background: "#eee7db" }}>
                    {v != null && (
                      <>
                        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: at(v, a.lo, a.hi), background: "#ffc6a5", borderRadius: 999, transition: tr("width", 0.5) }} />
                        <div
                          style={{
                            position: "absolute",
                            top: 1,
                            width: 12,
                            height: 12,
                            marginLeft: -6,
                            left: at(v, a.lo, a.hi),
                            borderRadius: "50%",
                            background: "#c67139",
                            transition: tr("left", 0.5),
                          }}
                        />
                      </>
                    )}
                    <div title="Season average" style={{ position: "absolute", top: -2, bottom: -2, width: 2, marginLeft: -1, left: at(s, a.lo, a.hi), background: "#2e2b25", transition: tr("left", 0.5) }} />
                  </div>
                  <span className="num" style={{ fontSize: 12, fontWeight: 700, textAlign: "right" }}>
                    {v != null ? a.fmt(v) : "—"}
                  </span>
                  <span className="num" style={{ fontSize: 11, fontWeight: 700, textAlign: "right", color: d >= 0 ? "#8c491a" : "#56633f" }}>
                    {v != null ? signed((v - s) * scale) : ""}
                  </span>
                </div>
              );
            })}
            <div className="note">Bar is this game; the dark tick is the season average. For DRtg, lower is better.</div>
          </div>

          <div className="row" style={{ gap: 6 }}>
            {tags.map((t) => (
              <span key={t.text} className="tag-pill" style={{ background: t.bg, color: t.fg }}>
                {t.text}
              </span>
            ))}
          </div>
        </>
      )}
      {tip.node}
    </Card>
  );
}
