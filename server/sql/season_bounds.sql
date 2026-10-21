-- Regular-season cutoff per season.
-- The is_playoff flag can't be trusted: 2001, 2002 and 2004 have no playoff rows,
-- 2003 flags only the Finals, and from 2020 on play-in games are tagged regular season.
--
-- Default rule: the regular season ends on the last calendar day with >= 8 games
-- (the final day always has most of the league playing; playoff days top out at 4).
-- If fewer than 14 days follow that day, there were no playoffs in the data
-- (2019-20 stops at the March 2020 suspension) and the season runs to its last game.
--
-- TODO(you): the NBA Cup final (Dec, 2023+) is counted here as a regular-season game,
-- which gives the two finalists 83 games. It doesn't count in the real standings.
-- Decide whether to exclude it, e.g. a single-game December day in a season >= 2023.
CREATE OR REPLACE TABLE season_bounds AS
WITH days AS (
  SELECT season_start_year AS season,
         (game_date AT TIME ZONE 'UTC')::DATE AS day,
         COUNT(*) AS n
  FROM nba.main_intermediate.int_games_enriched
  GROUP BY ALL
), b AS (
  SELECT season, MAX(day) FILTER (WHERE n >= 8) AS heavy_end, MAX(day) AS last_day
  FROM days GROUP BY season
)
SELECT season,
       CASE WHEN last_day - heavy_end < 14 THEN last_day ELSE heavy_end END AS reg_end
FROM b;
