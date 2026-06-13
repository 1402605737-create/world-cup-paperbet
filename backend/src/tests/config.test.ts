import assert from "node:assert/strict";
import test from "node:test";
import { getConfigStatus } from "../config.js";
import { fetchWorldCupMatches } from "../providers/apiFootballProvider.js";
import { fetchWorldCupOdds } from "../providers/theOddsApiProvider.js";

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

test("未配置的真实数据源不得显示为可用", () => {
  const previousSportsKey = process.env.SPORTS_API_KEY;
  const previousOddsKey = process.env.ODDS_API_KEY;
  delete process.env.SPORTS_API_KEY;
  delete process.env.ODDS_API_KEY;

  const status = getConfigStatus();
  assert.equal(status.sports_data.configured, false);
  assert.equal(status.odds_data.configured, false);
  assert.match(status.sports_data.message, /待配置/);
  assert.match(status.odds_data.message, /待配置/);

  restoreEnv("SPORTS_API_KEY", previousSportsKey);
  restoreEnv("ODDS_API_KEY", previousOddsKey);
});

test("缺少密钥时真实供应商必须明确失败且不得返回假数据", async () => {
  const previousSportsKey = process.env.SPORTS_API_KEY;
  const previousOddsKey = process.env.ODDS_API_KEY;
  delete process.env.SPORTS_API_KEY;
  delete process.env.ODDS_API_KEY;

  await assert.rejects(fetchWorldCupMatches(), /尚未配置/);
  await assert.rejects(fetchWorldCupOdds(), /尚未配置/);

  restoreEnv("SPORTS_API_KEY", previousSportsKey);
  restoreEnv("ODDS_API_KEY", previousOddsKey);
});
