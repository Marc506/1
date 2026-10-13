import { haversineMeters } from "@/lib/matching/geo";
import { nameSimilarity } from "@/lib/matching/similarity";
import type { Candidate, SearchQuery } from "./provider";

export type RankedCandidate = Candidate & {
  /** Meters from the bias center, when there is one. */
  distanceM?: number;
  score: number;
};

/**
 * Re-orders provider results: provider order × name similarity × distance
 * decay. Each factor has a floor, so no single one can bury a result.
 */
export function rankCandidates(
  query: string,
  candidates: Candidate[],
  bias?: SearchQuery["bias"],
): RankedCandidate[] {
  return candidates
    .map((c, index) => {
      const order = 1 - Math.min(index, 9) * 0.08;
      const similarity = nameSimilarity(query, c.name);
      const distanceM = bias ? haversineMeters(bias, c) : undefined;
      const decay =
        distanceM === undefined || !bias
          ? 1
          : Math.exp(-distanceM / (2 * bias.radiusM));
      const score =
        (0.5 + 0.5 * order) *
        (0.3 + 0.7 * similarity) *
        (bias ? 0.4 + 0.6 * decay : 1);
      return { ...c, distanceM, score, index };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ index, ...rest }) => rest);
}
