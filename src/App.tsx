import { BoxScoreCard } from "./cards/BoxScoreCard";
import { CareerArcsCard } from "./cards/CareerArcsCard";
import { GameTrendCard } from "./cards/GameTrendCard";
import { LeagueHistoryCard } from "./cards/LeagueHistoryCard";
import { PlayerVsPlayerCard } from "./cards/PlayerVsPlayerCard";
import { PressureMapCard } from "./cards/PressureMapCard";
import { ShotChartCard } from "./cards/ShotChartCard";
import { StandingsRaceCard } from "./cards/StandingsRaceCard";
import { TeamVsTeamCard } from "./cards/TeamVsTeamCard";
import { UsageEfficiencyCard } from "./cards/UsageEfficiencyCard";

export function App() {
  return (
    <main className="page">
      <header className="page-head">
        <div className="page-kicker">Courtside · stat visuals</div>
        <h1 className="page-title">Ten ways to look at the box score</h1>
        <p className="page-intro">
          Every card reads the dbt-built <b>int_games_enriched</b>, <b>int_player_performance</b>,{" "}
          <b>int_player_shots_enriched</b> and <b>int_team_performance</b> models, regular season only. Shot coordinates use the
          Basketball-Reference frame: 500 px across, 10 px per foot, hoop at (250, 52.5), baseline at the top. Team colors are
          identity marks only.
        </p>
      </header>
      <div className="cards">
        <ShotChartCard />
        <BoxScoreCard />
        <UsageEfficiencyCard />
        <PlayerVsPlayerCard />
        <TeamVsTeamCard />
        <StandingsRaceCard />
        <GameTrendCard />
        <CareerArcsCard />
        <LeagueHistoryCard />
        <PressureMapCard />
      </div>
    </main>
  );
}
