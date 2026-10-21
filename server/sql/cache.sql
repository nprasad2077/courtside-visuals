-- Startup cache tables in the in-memory catalog. Every endpoint reads these.

-- One row per regular-season player game (minutes > 0), with opponent from the game row.
CREATE OR REPLACE TABLE player_game AS
SELECT p.game_id, p.player_id, p.player_name, p.team,
       (p.game_date AT TIME ZONE 'UTC')::DATE AS game_date,
       p.season_start_year::INTEGER AS season,
       p.game_result, p.team_location,
       p.minutes_played::DOUBLE AS minutes_played,
       p.points::INTEGER AS points, p.assists::INTEGER AS assists, p.total_rebounds::INTEGER AS total_rebounds,
       p.steals::INTEGER AS steals, p.blocks::INTEGER AS blocks, p.turnovers::INTEGER AS turnovers,
       p.plus_minus::INTEGER AS plus_minus, p.net_rating::DOUBLE AS net_rating, p.box_plus_minus,
       p.field_goals_made::INTEGER AS field_goals_made, p.field_goals_attempted::INTEGER AS field_goals_attempted,
       p.three_pointers_made::INTEGER AS three_pointers_made, p.three_pointers_attempted::INTEGER AS three_pointers_attempted,
       p.true_shooting_pct, p.effective_fg_pct, p.usage_pct,
       p.offensive_rating::DOUBLE AS offensive_rating, p.defensive_rating::DOUBLE AS defensive_rating,
       p.usage_tier, p.impact_tier, p.shooting_efficiency_tier, p.minutes_based_role,
       p.is_double_double, p.is_triple_double, p.is_versatile, p.is_defensive_specialist, p.is_three_and_d,
       CASE WHEN p.team = g.home_team THEN g.visitor_team ELSE g.home_team END AS opponent,
       g.home_points::INTEGER AS home_points, g.visitor_points::INTEGER AS visitor_points
FROM nba.main_intermediate.int_player_performance p
JOIN nba.main_intermediate.int_games_enriched g USING (game_id)
JOIN season_bounds sb ON sb.season = p.season_start_year
WHERE p.minutes_played > 0
  AND NOT p.is_playoff
  AND (p.game_date AT TIME ZONE 'UTC')::DATE <= sb.reg_end;

-- Player season aggregates. TS% is FGA-weighted; rates are minutes-weighted.
CREATE OR REPLACE TABLE player_season AS
SELECT player_id, ANY_VALUE(player_name) AS player_name, season,
       arg_max(team, game_date) AS team, COUNT(*)::INTEGER AS gp,
       AVG(minutes_played) AS mpg, AVG(points) AS pts, AVG(total_rebounds) AS reb, AVG(assists) AS ast,
       AVG(steals) AS stl, AVG(blocks) AS blk, AVG(turnovers) AS tov, AVG(plus_minus) AS pm,
       SUM(points)::INTEGER AS tot_pts, SUM(total_rebounds)::INTEGER AS tot_reb, SUM(assists)::INTEGER AS tot_ast,
       SUM(true_shooting_pct * field_goals_attempted) / NULLIF(SUM(field_goals_attempted), 0) AS ts,
       (SUM(field_goals_made) + 0.5 * SUM(three_pointers_made)) / NULLIF(SUM(field_goals_attempted), 0) AS efg,
       SUM(three_pointers_made) / NULLIF(SUM(three_pointers_attempted), 0) AS tp_pct,
       SUM(usage_pct * minutes_played) / NULLIF(SUM(minutes_played), 0) AS usg,
       SUM(offensive_rating * minutes_played) / NULLIF(SUM(minutes_played), 0) AS ortg,
       SUM(defensive_rating * minutes_played) / NULLIF(SUM(minutes_played), 0) AS drtg,
       SUM(box_plus_minus * minutes_played) / NULLIF(SUM(minutes_played), 0) AS bpm,
       SUM(field_goals_attempted)::INTEGER AS fga, SUM(three_pointers_attempted)::INTEGER AS tpa
FROM player_game
GROUP BY player_id, season;

-- Regular-season, non-free-throw shots.
CREATE OR REPLACE TABLE shot AS
SELECT s.player_id, s.season_start_year AS season,
       LEAST(GREATEST(s.shot_x_coordinate, 0), 500)::INTEGER AS x,
       LEAST(GREATEST(s.shot_y_coordinate, 0), 418)::INTEGER AS y,
       s.is_made AS made, s.shot_distance_zone AS zone, s.is_three_pointer AS three,
       s.distance_ft::INTEGER AS dist, s.quarter_number AS q,
       s.seconds_remaining_in_quarter AS secs, s.score_margin_at_shot::INTEGER AS margin,
       s.is_clutch_shot AS clutch, s.game_date
FROM nba.main_intermediate.int_player_shots_enriched s
JOIN season_bounds sb ON sb.season = s.season_start_year
WHERE NOT s.is_free_throw AND NOT s.is_playoff AND s.game_date <= sb.reg_end
  AND s.shot_x_coordinate IS NOT NULL AND s.shot_y_coordinate IS NOT NULL;

-- Team stints: runs of consecutive games for one team, so a trade starts a new stint.
CREATE OR REPLACE TABLE player_stint AS
WITH g AS (
  SELECT player_id, team, season, game_date,
         (team IS DISTINCT FROM lag(team) OVER (PARTITION BY player_id ORDER BY game_date))::INTEGER AS brk
  FROM player_game
), r AS (
  SELECT *, SUM(brk) OVER (PARTITION BY player_id ORDER BY game_date ROWS UNBOUNDED PRECEDING) AS run FROM g
)
SELECT player_id, run::INTEGER AS run, ANY_VALUE(team) AS team,
       MIN(season)::INTEGER AS from_season, MAX(season)::INTEGER AS to_season, COUNT(*)::INTEGER AS gp
FROM r
GROUP BY player_id, run;

CREATE OR REPLACE TABLE player_index AS
WITH base AS (
  SELECT pg.player_id, ANY_VALUE(pg.player_name) AS player_name,
         strip_accents(lower(ANY_VALUE(pg.player_name))) AS name_key,
         MIN(pg.season)::INTEGER AS first_season, MAX(pg.season)::INTEGER AS last_season,
         arg_max(pg.team, pg.game_date) AS latest_team, COUNT(*)::INTEGER AS career_gp,
         SUM(pg.points)::INTEGER AS career_pts
  FROM player_game pg
  GROUP BY pg.player_id
), team_gp AS (
  SELECT player_id, team, SUM(gp) AS gp, MAX(to_season) AS last FROM player_stint GROUP BY player_id, team
), primary_team AS (
  -- The team he played the most games for; ties go to the more recent team.
  SELECT player_id, arg_max(team, gp * 10000 + last) AS team, arg_max(last, gp * 10000 + last)::INTEGER AS season
  FROM team_gp GROUP BY player_id
), stints AS (
  SELECT player_id,
         list({'team': team, 'from': from_season, 'to': to_season, 'gp': gp} ORDER BY run) AS stints
  FROM player_stint GROUP BY player_id
)
SELECT b.*, pt.team AS primary_team, pt.season AS primary_season, st.stints,
       b.player_id IN (SELECT DISTINCT player_id FROM shot) AS has_shots
FROM base b
JOIN primary_team pt USING (player_id)
JOIN stints st USING (player_id);

-- Regular-season team games with a running game number and games over .500.
CREATE OR REPLACE TABLE team_game AS
WITH t AS (
  SELECT t.game_id, t.team, (t.game_date AT TIME ZONE 'UTC')::DATE AS game_date,
         t.season_start_year::INTEGER AS season, t.game_result, t.opponent_team AS opponent,
         t.points::INTEGER AS points, t.offensive_rating, t.defensive_rating, t.net_rating, t.pace,
         t.effective_fg_pct, t.turnover_rate, t.offensive_rebound_rate, t.free_throw_rate,
         t.offensive_tier, t.defensive_tier, t.shot_selection_style, t.ball_movement_style, t.ball_security_tier,
         g.home_team = t.team AS home
  FROM nba.main_intermediate.int_team_performance t
  JOIN nba.main_intermediate.int_games_enriched g USING (game_id)
  JOIN season_bounds sb ON sb.season = t.season_start_year
  WHERE NOT t.is_playoff AND (t.game_date AT TIME ZONE 'UTC')::DATE <= sb.reg_end
)
SELECT t.*, o.points AS opp_points,
       ROW_NUMBER() OVER w AS game_no,
       SUM(CASE WHEN t.game_result = 'W' THEN 1 ELSE -1 END) OVER w AS over_500
FROM t LEFT JOIN t o ON o.game_id = t.game_id AND o.team = t.opponent
WINDOW w AS (PARTITION BY t.team, t.season ORDER BY t.game_date, t.game_id ROWS UNBOUNDED PRECEDING);

-- Team season aggregates; seed / last10 / streak are derived in TS from `results`.
CREATE OR REPLACE TABLE team_season AS
SELECT team, season,
       COUNT(*) FILTER (WHERE game_result = 'W')::INTEGER AS w,
       COUNT(*) FILTER (WHERE game_result = 'L')::INTEGER AS l,
       AVG(offensive_rating) AS ortg, AVG(defensive_rating) AS drtg, AVG(pace) AS pace,
       AVG(effective_fg_pct) AS efg, AVG(turnover_rate) AS tov,
       AVG(offensive_rebound_rate) AS orb, AVG(free_throw_rate) AS ftr,
       mode(offensive_tier) AS offensive_tier, mode(defensive_tier) AS defensive_tier,
       mode(shot_selection_style) AS shot_selection_style, mode(ball_movement_style) AS ball_movement_style,
       mode(ball_security_tier) AS ball_security_tier,
       list(game_result ORDER BY game_no) AS results
FROM team_game
GROUP BY team, season;

CREATE OR REPLACE TABLE league_season AS
SELECT t.season, t.pace, t.ortg, t.efg, t.tov, t.orb, t.ftr, p.three_rate
FROM (
  SELECT season, AVG(pace) AS pace, AVG(offensive_rating) AS ortg, AVG(effective_fg_pct) AS efg,
         AVG(turnover_rate) AS tov, AVG(offensive_rebound_rate) AS orb, AVG(free_throw_rate) AS ftr
  FROM team_game GROUP BY season
) t
JOIN (
  SELECT season, SUM(three_pointers_attempted) / SUM(field_goals_attempted) AS three_rate
  FROM player_game GROUP BY season
) p USING (season);

-- League FG% by season and distance zone: the "league expected" baseline for 1a.
CREATE OR REPLACE TABLE league_zone AS
SELECT season, zone, AVG(made::INTEGER) AS fg, COUNT(*)::INTEGER AS n
FROM shot GROUP BY season, zone;
