import type { Db } from "@/lib/db/client";
import { getCollection } from "@/lib/db/queries/collections";
import { mostRecentPlaceCoords } from "@/lib/db/queries/places";
import { detectQueryLanguage } from "@/lib/matching/language";
import { normalizeQuery } from "@/lib/matching/normalize";
import { readSearchCache, searchCacheKey, writeSearchCache } from "./cache";
import type { Geocoder } from "./geocoder";
import { MAX_RESULTS, type ProviderId, type SearchQuery } from "./provider";
import { rankCandidates, type RankedCandidate } from "./rank";

export const MIN_QUERY_LENGTH = 2;
const RECENT_BIAS_RADIUS_M = 30_000;

export type SearchBias = NonNullable<SearchQuery["bias"]> & {
  source: "collection" | "recent";
};

export type CollectionSearchResult =
  | {
      ok: true;
      query: string;
      candidates: RankedCandidate[];
      bias: SearchBias | null;
      provider: ProviderId;
      usedFallback: boolean;
      cached: boolean;
    }
  | { ok: false; error: "query_too_short" | "collection_not_found" };

/**
 * §6.1 step 3: normalize, pick a bias (collection center, else the owner's
 * last saved place), read the cache, ask the provider, rank, cap at 5.
 * Fallback results are not cached so the primary is tried again next time.
 */
export async function searchForCollection(
  deps: { db: Db; geocoder: Geocoder; primaryProvider: ProviderId },
  ownerId: string,
  input: { text: string; collectionId: string; language?: "zh-CN" | "en" },
): Promise<CollectionSearchResult> {
  const text = normalizeQuery(input.text);
  if ([...text].length < MIN_QUERY_LENGTH) {
    return { ok: false, error: "query_too_short" };
  }
  const collection = await getCollection(deps.db, ownerId, input.collectionId);
  if (!collection) return { ok: false, error: "collection_not_found" };

  let bias: SearchBias | null = null;
  if (collection.centerLat !== null && collection.centerLng !== null) {
    bias = {
      lat: collection.centerLat,
      lng: collection.centerLng,
      radiusM: collection.biasRadiusM,
      source: "collection",
    };
  } else {
    const recent = await mostRecentPlaceCoords(deps.db, ownerId);
    if (recent) {
      bias = { ...recent, radiusM: RECENT_BIAS_RADIUS_M, source: "recent" };
    }
  }

  const query: SearchQuery = {
    text,
    language: input.language ?? detectQueryLanguage(text),
    limit: MAX_RESULTS,
    ...(bias
      ? { bias: { lat: bias.lat, lng: bias.lng, radiusM: bias.radiusM } }
      : {}),
  };

  const key = searchCacheKey(deps.primaryProvider, query);
  const hit = await readSearchCache(deps.db, key);
  let candidates = hit;
  let provider = deps.primaryProvider;
  let usedFallback = false;
  if (!candidates) {
    const result = await deps.geocoder.search(query);
    candidates = result.candidates;
    provider = result.provider;
    usedFallback = result.usedFallback;
    if (!usedFallback) {
      await writeSearchCache(deps.db, key, result.provider, candidates);
    }
  }

  return {
    ok: true,
    query: text,
    candidates: rankCandidates(text, candidates, query.bias).slice(
      0,
      MAX_RESULTS,
    ),
    bias,
    provider,
    usedFallback,
    cached: hit !== undefined,
  };
}
