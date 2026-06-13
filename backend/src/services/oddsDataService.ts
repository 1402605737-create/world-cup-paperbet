import { fetchWorldCupOdds } from "../providers/theOddsApiProvider.js";
import { getTeamFlagMap } from "./sportsDataService.js";

export async function getWorldCupOdds() {
  return fetchWorldCupOdds(await getTeamFlagMap());
}
