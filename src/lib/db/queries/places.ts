import { and, desc, eq, getTableColumns, isNotNull, sql } from "drizzle-orm";
import type { Db } from "../client";
import {
  collectionPlaces,
  collections,
  mentions,
  places,
  type PlaceCategory,
  type SourceKind,
} from "../schema";
import { isUuid } from "./collections";

export type Place = typeof places.$inferSelect;

export type SavePlaceInput = {
  collectionId: string;
  place: {
    provider: string;
    /** null for a hand-placed pin. */
    providerPlaceId: string | null;
    name: string;
    formattedAddress: string | null;
    lat: number;
    lng: number;
    category: PlaceCategory;
  };
  note?: string | null;
  why?: string | null;
  sourceUrl?: string | null;
  sourceKind?: SourceKind | null;
  tags?: string[];
  priority?: number;
};

export type SavePlaceResult =
  | {
      ok: true;
      placeId: string;
      /** The place was saved before (same provider place id). */
      existing: boolean;
      /** It was already in this collection too. */
      alreadyInCollection: boolean;
    }
  | { ok: false; error: "collection_not_found" };

/**
 * Saves a matched place into a collection. A place the owner already saved
 * (same provider and provider place id) is reused: the new reason is
 * appended as a mention and the place is linked to this collection.
 */
export async function savePlaceToCollection(
  db: Db,
  ownerId: string,
  input: SavePlaceInput,
): Promise<SavePlaceResult> {
  if (!isUuid(input.collectionId)) {
    return { ok: false, error: "collection_not_found" };
  }

  return db.transaction(async (tx) => {
    const [collection] = await tx
      .select({ id: collections.id })
      .from(collections)
      .where(
        and(
          eq(collections.ownerId, ownerId),
          eq(collections.id, input.collectionId),
        ),
      );
    if (!collection) return { ok: false, error: "collection_not_found" };

    const { place } = input;
    const findExisting = async () => {
      if (!place.providerPlaceId) return undefined;
      const [row] = await tx
        .select()
        .from(places)
        .where(
          and(
            eq(places.ownerId, ownerId),
            eq(places.provider, place.provider),
            eq(places.providerPlaceId, place.providerPlaceId),
          ),
        );
      return row;
    };

    let existing = await findExisting();
    let placeId: string;
    if (existing) {
      placeId = existing.id;
      const mergedTags = [
        ...new Set([...existing.tags, ...(input.tags ?? [])]),
      ];
      await tx
        .update(places)
        .set({
          tags: mergedTags,
          ...(!existing.note && input.note ? { note: input.note } : {}),
        })
        .where(and(eq(places.ownerId, ownerId), eq(places.id, placeId)));
    } else {
      const [inserted] = await tx
        .insert(places)
        .values({
          ownerId,
          name: place.name,
          lat: place.lat,
          lng: place.lng,
          formattedAddress: place.formattedAddress,
          provider: place.provider,
          providerPlaceId: place.providerPlaceId,
          matched: place.provider !== "manual",
          category: place.category,
          tags: input.tags ?? [],
          priority: input.priority ?? 1,
          note: input.note ?? null,
        })
        .onConflictDoNothing({
          target: [places.ownerId, places.provider, places.providerPlaceId],
          where: isNotNull(places.providerPlaceId),
        })
        .returning({ id: places.id });
      if (inserted) {
        placeId = inserted.id;
      } else {
        // Saved concurrently by another request.
        existing = await findExisting();
        placeId = existing!.id;
      }
    }

    const linked = await tx
      .insert(collectionPlaces)
      .values({ ownerId, collectionId: collection.id, placeId })
      .onConflictDoNothing()
      .returning({ placeId: collectionPlaces.placeId });

    if (input.why || input.sourceUrl) {
      await tx.insert(mentions).values({
        ownerId,
        placeId,
        why: input.why ?? null,
        sourceUrl: input.sourceUrl ?? null,
        sourceKind: input.sourceKind ?? "other",
      });
    }

    return {
      ok: true,
      placeId,
      existing: existing !== undefined,
      alreadyInCollection: linked.length === 0,
    };
  });
}

/** Coordinates of the owner's most recently saved place, for search bias. */
export async function mostRecentPlaceCoords(
  db: Db,
  ownerId: string,
): Promise<{ lat: number; lng: number } | undefined> {
  const [row] = await db
    .select({ lat: places.lat, lng: places.lng })
    .from(places)
    .where(eq(places.ownerId, ownerId))
    .orderBy(desc(places.createdAt))
    .limit(1);
  return row;
}

export type CollectionPlace = Place & {
  addedAt: Date;
  mentionCount: number;
};

export async function listCollectionPlaces(
  db: Db,
  ownerId: string,
  collectionId: string,
): Promise<CollectionPlace[]> {
  if (!isUuid(collectionId)) return [];
  return db
    .select({
      ...getTableColumns(places),
      addedAt: collectionPlaces.addedAt,
      mentionCount: sql<number>`(select count(*)::int from ${mentions} where ${mentions.placeId} = ${places.id} and ${mentions.ownerId} = ${ownerId})`,
    })
    .from(collectionPlaces)
    .innerJoin(places, eq(places.id, collectionPlaces.placeId))
    .where(
      and(
        eq(collectionPlaces.ownerId, ownerId),
        eq(collectionPlaces.collectionId, collectionId),
        eq(places.ownerId, ownerId),
      ),
    )
    .orderBy(desc(collectionPlaces.addedAt));
}
