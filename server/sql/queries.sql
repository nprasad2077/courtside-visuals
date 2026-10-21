-- Request-time queries. Every one is a prepared statement; user input is only ever a bound `?`.

-- name: meta_seasons
SELECT MIN(season)::INTEGER AS lo, MAX(season)::INTEGER AS hi FROM season_bounds;

-- name: meta_shot_seasons
SELECT MIN(season)::INTEGER AS lo, MAX(season)::INTEGER AS hi FROM shot;

-- name: player_search
-- params: q, excludeIds (comma list), limit
WITH k AS (SELECT strip_accents(lower(trim(?))) AS q)
SELECT player_id AS id, player_name AS name, primary_team AS team, primary_season AS "teamSeason",
       first_season AS "firstSeason", last_season AS "lastSeason", stints
FROM player_index, k
WHERE contains(name_key, k.q)
  AND NOT list_contains(string_split(?, ','), player_id)
ORDER BY CASE WHEN starts_with(name_key, k.q) THEN 0
              WHEN contains(' ' || name_key, ' ' || k.q) THEN 1
              ELSE 2 END,
         career_gp DESC, player_name
LIMIT ?;

-- name: players_with_shots
SELECT player_id AS id, player_name AS name, primary_team AS team, primary_season AS "teamSeason",
       first_season AS "firstSeason", last_season AS "lastSeason", stints
FROM player_index WHERE has_shots ORDER BY player_name;

-- name: player_seasons
SELECT season FROM player_season WHERE player_id = ? ORDER BY season;

-- name: player_shot_seasons
SELECT DISTINCT season FROM shot WHERE player_id = ? ORDER BY season;

-- name: player_shots
SELECT x, y, made, zone, three, dist, q, secs, margin, clutch
FROM shot WHERE player_id = ? AND season = ?
ORDER BY game_date, q, secs DESC;

-- name: league_zones
SELECT zone, fg FROM league_zone WHERE season = ?;

-- name: player_gamelog
SELECT game_id, game_date, team, opponent, game_result, team_location, minutes_played,
       points, total_rebounds, assists, steals, blocks, turnovers, plus_minus, box_plus_minus,
       field_goals_made, field_goals_attempted, three_pointers_made, three_pointers_attempted,
       true_shooting_pct, effective_fg_pct, usage_pct, offensive_rating, defensive_rating,
       usage_tier, impact_tier, shooting_efficiency_tier, minutes_based_role,
       is_double_double, is_triple_double, is_versatile, is_defensive_specialist, is_three_and_d,
       home_points, visitor_points
FROM player_game WHERE player_id = ? AND season = ?
ORDER BY game_date, game_id;

-- name: player_season
SELECT *, ortg - drtg AS net FROM player_season WHERE player_id = ? AND season = ?;

-- name: player_career
SELECT *, ortg - drtg AS net FROM player_season WHERE player_id = ? ORDER BY season;

-- name: player_name
SELECT player_name AS name, latest_team AS team FROM player_index WHERE player_id = ?;

-- name: top_career
SELECT player_id AS id FROM player_index ORDER BY career_pts DESC LIMIT ?;

-- name: league_rotation
SELECT player_id AS id, player_name AS name, team, mpg, usg, ts, bpm, gp, pts
FROM player_season
WHERE season = ? AND gp >= ? AND mpg >= ? AND usg IS NOT NULL AND ts IS NOT NULL
ORDER BY player_id;

-- name: team_season
SELECT team, w, l, ortg, drtg, ortg - drtg AS net, pace, efg, tov, orb, ftr,
       offensive_tier, defensive_tier, shot_selection_style, ball_movement_style, ball_security_tier,
       results
FROM team_season WHERE season = ? ORDER BY team;

-- name: team_race
SELECT team, list(over_500 ORDER BY game_no) AS series
FROM team_game WHERE season = ? GROUP BY team ORDER BY team;

-- name: team_h2h
SELECT game_date AS date, home, points AS "aPts", opp_points AS "bPts",
       CASE WHEN game_result = 'W' THEN team ELSE opponent END AS winner, game_no
FROM team_game WHERE team = ? AND opponent = ? AND season = ?
ORDER BY game_date;

-- name: league_history
SELECT * FROM league_season ORDER BY season;
