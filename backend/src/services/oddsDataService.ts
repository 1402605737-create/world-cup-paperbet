import { fetchWorldCupOdds } from "../providers/theOddsApiProvider.js";

export async function getWorldCupOdds() {
  return fetchWorldCupOdds();
}
