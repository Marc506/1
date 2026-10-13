import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { searchCache } from "@/lib/db/schema";
import type { Candidate, ProviderId, SearchQuery } from "./provider";

export const SEARCH_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * sha256(provider | language | query | bias). The bias center is rounded to
 * ~100 m so small changes to a collection's center still hit the cache.
 */
export function searchCacheKey(
  provider: ProviderId,
  q: Pick<SearchQuery, "text" | "language" | "bias">,
): string {
  const bias = q.bias
    ? `${q.bias.lat.toFixed(3)},${q.bias.lng.toFixed(3)},${q.bias.radiusM}`
    : "-";
  return createHash("sha256")
    .update([provider, q.language, q.text.toLowerCase(), bias].join("|"))
    .digest("hex");
}

export async function readSearchCache(
  db: Db,
  key: string,
  now: Date = new Date(),
): Promise<Candidate[] | undefined> {
  const [row] = await db
    .select()
    .from(searchCache)
    .where(eq(searchCache.key, key));
  if (!row) return undefined;
  if (now.getTime() - row.createdAt.getTime() > SEARCH_CACHE_TTL_MS) {
    return undefined;
  }
  return row.response as Candidate[];
}

export async function writeSearchCache(
  db: Db,
  key: string,
  provider: ProviderId,
  candidates: Candidate[],
): Promise<void> {
  await db
    .insert(searchCache)
    .values({ key, provider, response: candidates })
    .onConflictDoUpdate({
      target: searchCache.key,
      set: { provider, response: candidates, createdAt: new Date() },
    });
}
