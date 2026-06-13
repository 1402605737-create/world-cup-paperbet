export type ConfigStatus = {
  deepseek: {
    configured: boolean;
    model: string;
    base_url: string;
  };
  sports_data: {
    configured: boolean;
    provider: string;
    message: string;
  };
  odds_data: {
    configured: boolean;
    provider: string;
    message: string;
  };
  database: {
    configured: boolean;
    engine: "postgres" | "unconfigured";
  };
};

const hasValue = (value: string | undefined) => Boolean(value?.trim());

export function getConfigStatus(): ConfigStatus {
  const sportsConfigured =
    hasValue(process.env.SPORTS_API_BASE_URL) &&
    hasValue(process.env.SPORTS_API_KEY);
  const oddsConfigured =
    hasValue(process.env.ODDS_API_BASE_URL) && hasValue(process.env.ODDS_API_KEY);

  return {
    deepseek: {
      configured: hasValue(process.env.DEEPSEEK_API_KEY),
      model: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
      base_url: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
    },
    sports_data: {
      configured: sportsConfigured,
      provider: process.env.SPORTS_DATA_PROVIDER || "API_FOOTBALL",
      message: sportsConfigured
        ? "真实赛事数据源已配置。"
        : "真实赛事数据源未配置，无法加载世界杯赛程。",
    },
    odds_data: {
      configured: oddsConfigured,
      provider: process.env.ODDS_DATA_PROVIDER || "THE_ODDS_API",
      message: oddsConfigured
        ? "真实赔率数据源已配置。"
        : "真实赔率数据源未配置，无法生成 Agent 策略。",
    },
    database: {
      configured: hasValue(process.env.DATABASE_URL),
      engine: hasValue(process.env.DATABASE_URL) ? "postgres" : "unconfigured",
    },
  };
}

export function getAllowedOrigins(): string[] {
  const configured = (process.env.FRONTEND_ORIGIN || "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);

  if (process.env.NODE_ENV === "production") {
    return configured;
  }

  return [...new Set([...configured, "http://localhost:8081", "http://localhost:19006"])];
}

