import { APP_SCHEMA, query } from "../db.js";
import {
  fetchCountryFlags,
  fetchWorldCupMatches,
  type CountryFlag,
  type StandardMatch,
} from "../providers/apiFootballProvider.js";

export async function syncWorldCupResults() {
  const flags = await fetchCountryFlags();
  const matches = await fetchWorldCupMatches(flags);

  await query(
    `insert into ${APP_SCHEMA}.team_flags (team_name, country_code, flag_url, data_source)
     select team_name, country_code, flag_url, 'API_FOOTBALL'
     from jsonb_to_recordset($1::jsonb)
       as x(team_name text, country_code text, flag_url text)
     on conflict (team_name) do update set
       country_code = excluded.country_code,
       flag_url = excluded.flag_url,
       updated_at = now()`,
    [
      JSON.stringify(
        flags.map((country) => ({
          team_name: country.name,
          country_code: country.code,
          flag_url: country.flag_url,
        })),
      ),
    ],
  );

  await query(
    `insert into ${APP_SCHEMA}.matches (
       external_match_id, home_team, away_team, group_name, stage, kickoff_time,
       status, home_score, away_score, home_team_flag_url, away_team_flag_url, data_source
     )
     select external_match_id, home_team, away_team, group_name, stage, kickoff_time,
       status, home_score, away_score, home_team_flag_url, away_team_flag_url, 'API_FOOTBALL'
     from jsonb_to_recordset($1::jsonb) as x(
       external_match_id text, home_team text, away_team text, group_name text, stage text,
       kickoff_time timestamptz, status text, home_score integer, away_score integer,
       home_team_flag_url text, away_team_flag_url text
     )
     on conflict (external_match_id) do update set
       home_team = excluded.home_team,
       away_team = excluded.away_team,
       group_name = excluded.group_name,
       stage = excluded.stage,
       kickoff_time = excluded.kickoff_time,
       status = excluded.status,
       home_score = excluded.home_score,
       away_score = excluded.away_score,
       home_team_flag_url = excluded.home_team_flag_url,
       away_team_flag_url = excluded.away_team_flag_url,
       updated_at = now()`,
    [JSON.stringify(matches)],
  );

  return { match_count: matches.length, flag_count: flags.length };
}

export async function getWorldCupMatches(): Promise<StandardMatch[]> {
  const result = await query<StandardMatch>(
    `select external_match_id, home_team, away_team, group_name, stage, kickoff_time,
       status, home_score, away_score, home_team_flag_url, away_team_flag_url, data_source
     from ${APP_SCHEMA}.matches
     order by kickoff_time desc`,
  );
  return result.rows;
}

export async function getTeamFlagMap(): Promise<Map<string, string>> {
  const result = await query<CountryFlag & { team_name: string }>(
    `select team_name, country_code as code, flag_url
     from ${APP_SCHEMA}.team_flags`,
  );
  return new Map(result.rows.map((item) => [item.team_name.toLowerCase(), item.flag_url]));
}
