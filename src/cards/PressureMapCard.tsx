import { Fragment, useState } from "react";
import { Card } from "../components/Card";
import { Tip, useChartTooltip } from "../components/ChartTooltip";
import { PlayerSelect } from "../components/PlayerSelect";
import { SeasonSlider } from "../components/SeasonSlider";
import { StatTile } from "../components/StatTile";
import { usePlayersWithShots, useSeasonFor, useShots, type Shot } from "../lib/api";
import { diverging } from "../lib/color";
import { pct, seasonLabel, signed } from "../lib/format";
import { useTransition } from "../lib/motion";

/** Score-margin rows, from the shooter's side. `clutch` rows sit on the tinted band. */
const ROWS: { label: string; test: (m: number) => boolean; tone: "up" | "even" | "down"; clutch?: boolean }[] = [
  { label: "Up 10+", test: (m) => m >= 10, tone: "up" },
  { label: "Up 6–9", test: (m) => m >= 6 && m <= 9, tone: "up" },
  { label: "Up 1–5", test: (m) => m >= 1 && m <= 5, tone: "up", clutch: true },
  { label: "Tied", test: (m) => m === 0, tone: "even", clutch: true },
  { label: "Down 1–5", test: (m) => m <= -1 && m >= -5, tone: "down", clutch: true },
  { label: "Down 6–9", test: (m) => m <= -6 && m >= -9, tone: "down" },
  { label: "Down 10+", test: (m) => m <= -10, tone: "down" },
];
const COLS: { label: string; test: (q: number) => boolean }[] = [
  { label: "Q1", test: (q) => q === 1 },
  { label: "Q2", test: (q) => q === 2 },
  { label: "Q3", test: (q) => q === 3 },
  { label: "Q4", test: (q) => q === 4 },
  { label: "OT", test: (q) => q >= 5 },
];
const TONE = { up: "#b2622d", even: "#474238", down: "#56633f" };

const fg = (xs: Shot[]) => (xs.length ? xs.filter((s) => s.made).length / xs.length : null);

export function PressureMapCard() {
  const players = usePlayersWithShots().data ?? [];
  const [id, setId] = useState("curryst01");
  const { season, setSeason, seasons } = useSeasonFor(id, { shots: true, initial: 2016 });
  const shots = useShots(id, season).data ?? [];
  const tip = useChartTooltip();
  const tr = useTransition();

  const seasonFg = fg(shots) ?? 0;
  const cells = ROWS.map((r) => COLS.map((c) => shots.filter((s) => r.test(s.margin) && c.test(s.q))));
  const maxN = Math.max(1, ...cells.flat().map((c) => c.length));
  const clutch = shots.filter((s) => s.clutch);
  const late = shots.filter((s) => s.q >= 4 && !s.clutch);
  const clutchFg = fg(clutch);
  const lateFg = fg(late);
  const name = players.find((p) => p.id === id)?.name ?? "";

  return (
    <Card
      id="1j"
      width={620}
      caption="Field-goal percentage by quarter and score margin, against the player's own season rate"
      kicker="Pressure map · int_player_shots_enriched"
      title={name ? `${name} under pressure` : "Pressure map"}
      sub={`${season ? seasonLabel(season) : ""} · circle size is attempts, color is FG% above or below the season rate`}
      controls={
        <div className="row">
          <PlayerSelect value={id} onChange={setId} />
          <SeasonSlider value={season} onChange={setSeason} seasons={seasons} />
        </div>
      }
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 10 }}>
        <StatTile label="Season FG%" value={shots.length ? pct(seasonFg) : "—"} sub={`${shots.length.toLocaleString("en-US")} FGA`} />
        <StatTile label="Clutch FG%" value={clutchFg != null ? pct(clutchFg) : "—"} sub={`${clutch.length} clutch FGA`} />
        <StatTile
          label="Clutch vs late"
          value={clutchFg != null && lateFg != null ? signed((clutchFg - lateFg) * 100) : "—"}
          sub={lateFg != null ? `other Q4/OT ${pct(lateFg)}%` : "no other late shots"}
        />
      </div>

      <div role="table" aria-label="FG% by quarter and margin" style={{ display: "grid", gridTemplateColumns: "72px repeat(5, minmax(0,1fr))", alignItems: "center" }}>
        <span />
        {COLS.map((c) => (
          <span key={c.label} className="tile-label" style={{ textAlign: "center", paddingBottom: 6 }}>
            {c.label}
          </span>
        ))}
        {ROWS.map((r, ri) => {
          const band = r.clutch ? "#f5ead8" : "transparent";
          const first = r.clutch && !ROWS[ri - 1]?.clutch;
          const last = r.clutch && !ROWS[ri + 1]?.clutch;
          const edge = { borderTopLeftRadius: first ? 16 : 0, borderBottomLeftRadius: last ? 16 : 0 };
          return (
            <Fragment key={r.label}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: TONE[r.tone], background: band, height: 52, display: "flex", alignItems: "center", paddingLeft: 10, ...edge }}>
                {r.label}
              </span>
              {COLS.map((c, ci) => {
                const xs = cells[ri][ci];
                const n = xs.length;
                const v = fg(xs);
                const d = n ? Math.max(12, Math.sqrt(n / maxN) * 44) : 6;
                const delta = v != null ? v - seasonFg : 0;
                const fill = n >= 3 ? diverging(delta, 0.15) : "#dcd3c4";
                const isLast = ci === COLS.length - 1;
                return (
                  <div
                    key={c.label}
                    style={{
                      height: 52,
                      display: "grid",
                      placeItems: "center",
                      background: band,
                      borderTopRightRadius: isLast && first ? 16 : 0,
                      borderBottomRightRadius: isLast && last ? 16 : 0,
                    }}
                  >
                    <div
                      onMouseMove={(e) =>
                        tip.show(
                          e,
                          <Tip
                            title={`${r.label} · ${c.label}`}
                            rows={[
                              ["Shots", n ? `${xs.filter((s) => s.made).length}/${n}` : "None"],
                              ["FG%", v != null ? pct(v) : "—"],
                              ["vs season", v != null ? signed(delta * 100) : "—"],
                            ]}
                          />,
                        )
                      }
                      onMouseLeave={tip.hide}
                      style={{
                        width: d,
                        height: d,
                        borderRadius: "50%",
                        background: fill,
                        display: "grid",
                        placeItems: "center",
                        cursor: "pointer",
                        transition: [tr("width, height", 0.5), tr("background", 0.4)].filter((t) => t !== "none").join(", ") || "none",
                      }}
                    >
                      {n >= 10 && d >= 30 && v != null && (
                        <span className="num" style={{ fontSize: 10.5, fontWeight: 800, color: Math.abs(delta) > 0.08 ? "#fbf7f0" : "#2e2b25" }}>
                          {pct(v, 0)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </Fragment>
          );
        })}
      </div>
      <div className="note">
        The tinted band is one-possession territory (within five points), where clutch shots live. Clutch FG% uses the dbt model's is_clutch_shot
        flag.
        {!shots.some((s) => s.q >= 5) && " The data has no OT shots for this season."}
      </div>
      {tip.node}
    </Card>
  );
}
