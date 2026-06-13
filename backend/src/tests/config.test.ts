import assert from "node:assert/strict";
import test from "node:test";
import { getConfigStatus } from "../config.js";

test("unconfigured real data providers never claim to be available", () => {
  const previousSportsKey = process.env.SPORTS_API_KEY;
  const previousOddsKey = process.env.ODDS_API_KEY;
  delete process.env.SPORTS_API_KEY;
  delete process.env.ODDS_API_KEY;

  const status = getConfigStatus();
  assert.equal(status.sports_data.configured, false);
  assert.equal(status.odds_data.configured, false);
  assert.match(status.sports_data.message, /未配置/);
  assert.match(status.odds_data.message, /未配置/);

  process.env.SPORTS_API_KEY = previousSportsKey;
  process.env.ODDS_API_KEY = previousOddsKey;
});

