import { z } from "zod";

export type StandardMatch = {
  external_match_id: string;
  home_team: string;
  away_team: string;
  group_name: string;
  stage: string;
  kickoff_time: string;
  status: "scheduled" | "live" | "finished";
  home_score: number | null;
  away_score: number | null;
  home_team_flag_url: string;
  away_team_flag_url: string;
  data_source: "API_FOOTBALL";
};

export type CountryFlag = {
  name: string;
  code: string | null;
  flag_url: string;
};

const fixtureSchema = z.object({
  fixture: z.object({
    id: z.number(),
    date: z.string(),
    status: z.object({ short: z.string() }),
  }),
  league: z.object({ round: z.string().nullable().optional() }),
  teams: z.object({
    home: z.object({ name: z.string(), logo: z.string() }),
    away: z.object({ name: z.string(), logo: z.string() }),
  }),
  goals: z.object({
    home: z.number().nullable(),
    away: z.number().nullable(),
  }),
});

const responseSchema = z.object({
  errors: z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]).optional(),
  response: z.array(fixtureSchema),
});

const countryResponseSchema = z.object({
  response: z.array(
    z.object({
      name: z.string(),
      code: z.string().nullable(),
      flag: z.string(),
    }),
  ),
});

function apiConfig() {
  const apiKey = process.env.SPORTS_API_KEY;
  if (!apiKey) throw new Error("真实赛事数据源尚未配置，无法加载世界杯赛程。");
  return {
    apiKey,
    baseUrl: (process.env.SPORTS_API_BASE_URL || "https://v3.football.api-sports.io").replace(/\/$/, ""),
  };
}

function normalizeStatus(short: string): StandardMatch["status"] {
  if (["FT", "AET", "PEN"].includes(short)) return "finished";
  if (["1H", "HT", "2H", "ET", "BT", "P", "LIVE"].includes(short)) return "live";
  return "scheduled";
}

export async function fetchCountryFlags(): Promise<CountryFlag[]> {
  const { apiKey, baseUrl } = apiConfig();
  const response = await fetch(`${baseUrl}/countries`, {
    headers: { "x-apisports-key": apiKey },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`国家旗帜服务返回错误状态：${response.status}`);
  return countryResponseSchema.parse(await response.json()).response.map((country) => ({
    name: country.name,
    code: country.code,
    flag_url: country.flag,
  }));
}

export async function fetchWorldCupMatches(flags: CountryFlag[] = []): Promise<StandardMatch[]> {
  const { apiKey, baseUrl } = apiConfig();
  const league = process.env.SPORTS_LEAGUE_ID || "1";
  const season = process.env.SPORTS_SEASON || "2022";
  const flagsByName = new Map(flags.map((country) => [country.name.toLowerCase(), country.flag_url]));
  const url = new URL(`${baseUrl}/fixtures`);
  url.searchParams.set("league", league);
  url.searchParams.set("season", season);

  const response = await fetch(url, {
    headers: { "x-apisports-key": apiKey },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`真实赛事服务返回错误状态：${response.status}`);

  const parsed = responseSchema.parse(await response.json());
  if (parsed.response.length === 0) {
    throw new Error("真实赛事供应商当前尚未提供 2026 世界杯赛程。");
  }

  return parsed.response
    .map((item) => ({
      external_match_id: String(item.fixture.id),
      home_team: item.teams.home.name,
      away_team: item.teams.away.name,
      group_name: item.league.round || "待确认",
      stage: item.league.round || "待确认",
      kickoff_time: item.fixture.date,
      status: normalizeStatus(item.fixture.status.short),
      home_score: item.goals.home,
      away_score: item.goals.away,
      home_team_flag_url: flagsByName.get(item.teams.home.name.toLowerCase()) || item.teams.home.logo,
      away_team_flag_url: flagsByName.get(item.teams.away.name.toLowerCase()) || item.teams.away.logo,
      data_source: "API_FOOTBALL" as const,
    }))
    .sort((a, b) => a.kickoff_time.localeCompare(b.kickoff_time));
}
