import { fetchWorldCupMatches } from "../providers/apiFootballProvider.js";

export async function getWorldCupMatches() {
  return fetchWorldCupMatches();
}
