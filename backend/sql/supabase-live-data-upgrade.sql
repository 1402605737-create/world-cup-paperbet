-- 仅在当前项目独立 Schema 中新增真实赛程与国旗缓存。
-- 不修改其他 Schema、角色、表或权限。

create table world_cup_paperbet.team_flags (
  id uuid primary key default gen_random_uuid(),
  team_name text unique not null,
  country_code text,
  flag_url text not null,
  data_source text not null check (data_source = 'API_FOOTBALL'),
  updated_at timestamptz not null default now()
);

create table world_cup_paperbet.matches (
  id uuid primary key default gen_random_uuid(),
  external_match_id text unique not null,
  home_team text not null,
  away_team text not null,
  group_name text not null,
  stage text not null,
  kickoff_time timestamptz not null,
  status text not null check (status in ('scheduled', 'live', 'finished')),
  home_score integer,
  away_score integer,
  home_team_flag_url text not null,
  away_team_flag_url text not null,
  data_source text not null check (data_source = 'API_FOOTBALL'),
  updated_at timestamptz not null default now()
);

create index world_cup_paperbet_matches_kickoff_time_idx
  on world_cup_paperbet.matches (kickoff_time desc);

grant select, insert, update on world_cup_paperbet.team_flags to world_cup_paperbet_app;
grant select, insert, update on world_cup_paperbet.matches to world_cup_paperbet_app;

alter table world_cup_paperbet.team_flags enable row level security;
alter table world_cup_paperbet.matches enable row level security;

create policy world_cup_paperbet_team_flags_select
  on world_cup_paperbet.team_flags for select to world_cup_paperbet_app using (true);
create policy world_cup_paperbet_team_flags_insert
  on world_cup_paperbet.team_flags for insert to world_cup_paperbet_app
  with check (data_source = 'API_FOOTBALL');
create policy world_cup_paperbet_team_flags_update
  on world_cup_paperbet.team_flags for update to world_cup_paperbet_app
  using (data_source = 'API_FOOTBALL') with check (data_source = 'API_FOOTBALL');

create policy world_cup_paperbet_matches_select
  on world_cup_paperbet.matches for select to world_cup_paperbet_app using (true);
create policy world_cup_paperbet_matches_insert
  on world_cup_paperbet.matches for insert to world_cup_paperbet_app
  with check (data_source = 'API_FOOTBALL');
create policy world_cup_paperbet_matches_update
  on world_cup_paperbet.matches for update to world_cup_paperbet_app
  using (data_source = 'API_FOOTBALL') with check (data_source = 'API_FOOTBALL');
