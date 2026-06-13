import { z } from "zod";

export type StandardOdds = {
  external_event_id: string;
  home_team: string;
  away_team: string;
  kickoff_time: string;
  bookmaker: string;
  region: string;
  home_team_flag_url: string | null;
  away_team_flag_url: string | null;
  selections: Array<{ selection: "home" | "draw" | "away"; odds: number }>;
  data_source: "THE_ODDS_API";
};

export type StandardScore = {
  external_event_id: string;
  home_team: string;
  away_team: string;
  kickoff_time: string;
  completed: boolean;
  home_score: number | null;
  away_score: number | null;
  last_update: string | null;
  home_team_flag_url: string | null;
  away_team_flag_url: string | null;
  data_source: "THE_ODDS_API";
};

const eventSchema = z.object({
  id: z.string(),
  commence_time: z.string(),
  home_team: z.string(),
  away_team: z.string(),
  bookmakers: z.array(
    z.object({
      title: z.string(),
      markets: z.array(
        z.object({
          key: z.string(),
          outcomes: z.array(z.object({ name: z.string(), price: z.number() })),
        }),
      ),
    }),
  ),
});

const scoreEventSchema = z.object({
  id: z.string(),
  commence_time: z.string(),
  completed: z.boolean(),
  home_team: z.string(),
  away_team: z.string(),
  scores: z.array(z.object({ name: z.string(), score: z.string() })).nullable(),
  last_update: z.string().nullable().optional(),
});

function oddsApiConfig() {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) throw new Error("真实赔率数据源尚未配置，无法加载世界杯数据。");
  return {
    apiKey,
    baseUrl: (process.env.ODDS_API_BASE_URL || "https://api.the-odds-api.com").replace(/\/$/, ""),
    sportKey: process.env.ODDS_SPORT_KEY || "soccer_fifa_world_cup",
  };
}

export async function fetchWorldCupOdds(flagsByName: Map<string, string> = new Map()): Promise<StandardOdds[]> {
  const { apiKey, baseUrl, sportKey } = oddsApiConfig();
  const region = process.env.ODDS_REGION || "eu";
  const url = new URL(`${baseUrl}/v4/sports/${sportKey}/odds`);
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("regions", region);
  url.searchParams.set("markets", process.env.ODDS_MARKET || "h2h");
  url.searchParams.set("oddsFormat", process.env.ODDS_FORMAT || "decimal");

  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`真实赔率服务返回错误状态：${response.status}`);
  const events = z.array(eventSchema).parse(await response.json());

  return events.flatMap((event) => {
    const bookmaker = event.bookmakers.find((item) => item.markets.some((market) => market.key === "h2h"));
    const market = bookmaker?.markets.find((item) => item.key === "h2h");
    if (!bookmaker || !market) return [];

    const selections: StandardOdds["selections"] = market.outcomes.flatMap((outcome) => {
      const selection: StandardOdds["selections"][number]["selection"] | null =
        outcome.name === event.home_team
          ? "home"
          : outcome.name === event.away_team
            ? "away"
            : outcome.name.toLowerCase() === "draw"
              ? "draw"
              : null;
      return selection ? [{ selection, odds: outcome.price }] : [];
    });

    if (selections.length !== 3) return [];
    return [{
      external_event_id: event.id,
      home_team: event.home_team,
      away_team: event.away_team,
      kickoff_time: event.commence_time,
      bookmaker: bookmaker.title,
      region,
      home_team_flag_url: flagsByName.get(event.home_team.toLowerCase()) || null,
      away_team_flag_url: flagsByName.get(event.away_team.toLowerCase()) || null,
      selections,
      data_source: "THE_ODDS_API" as const,
    }];
  });
}

export async function fetchWorldCupScores(flagsByName: Map<string, string> = new Map()): Promise<StandardScore[]> {
  const { apiKey, baseUrl, sportKey } = oddsApiConfig();
  const url = new URL(`${baseUrl}/v4/sports/${sportKey}/scores`);
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("daysFrom", "3");
  url.searchParams.set("dateFormat", "iso");

  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`本届比分服务返回错误状态：${response.status}`);
  const events = z.array(scoreEventSchema).parse(await response.json());

  return events.map((event) => {
    const scores = new Map((event.scores || []).map((item) => [item.name, Number(item.score)]));
    return {
      external_event_id: event.id,
      home_team: event.home_team,
      away_team: event.away_team,
      kickoff_time: event.commence_time,
      completed: event.completed,
      home_score: scores.get(event.home_team) ?? null,
      away_score: scores.get(event.away_team) ?? null,
      last_update: event.last_update || null,
      home_team_flag_url: flagsByName.get(event.home_team.toLowerCase()) || null,
      away_team_flag_url: flagsByName.get(event.away_team.toLowerCase()) || null,
      data_source: "THE_ODDS_API" as const,
    };
  });
}
