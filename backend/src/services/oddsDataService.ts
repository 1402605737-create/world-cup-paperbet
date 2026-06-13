import { fetchWorldCupOdds, fetchWorldCupScores } from "../providers/theOddsApiProvider.js";
import { getTeamFlagMap } from "./sportsDataService.js";

export async function getWorldCupOdds() {
  return fetchWorldCupOdds(await getTeamFlagMap());
}

export async function getWorldCupScores() {
  return fetchWorldCupScores(await getTeamFlagMap());
}
