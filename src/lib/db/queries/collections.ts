import { and, asc, count, desc, eq, getTableColumns } from "drizzle-orm";
import type { Db } from "../client";
import { collectionPlaces, collections } from "../schema";

export type Collection = typeof collections.$inferSelect;
export type CollectionWithCount = Collection & { placeCount: number };

export type CollectionFields = {
  name: string;
  emoji: string | null;
  cityName: string | null;
  centerLat: number | null;
  centerLng: number | null;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Postgres rejects malformed uuids with an error; treat them as not found. */
export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export async function listCollections(
  db: Db,
  ownerId: string,
  opts: { archived?: boolean } = {},
): Promise<CollectionWithCount[]> {
  return db
    .select({
      ...getTableColumns(collections),
      placeCount: count(collectionPlaces.placeId),
    })
    .from(collections)
    .leftJoin(
      collectionPlaces,
      and(
        eq(collectionPlaces.collectionId, collections.id),
        eq(collectionPlaces.ownerId, ownerId),
      ),
    )
    .where(
      and(
        eq(collections.ownerId, ownerId),
        eq(collections.archived, opts.archived ?? false),
      ),
    )
    .groupBy(collections.id)
    .orderBy(asc(collections.sortOrder), desc(collections.createdAt));
}

export async function countArchivedCollections(
  db: Db,
  ownerId: string,
): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(collections)
    .where(
      and(eq(collections.ownerId, ownerId), eq(collections.archived, true)),
    );
  return row?.n ?? 0;
}

export async function getCollection(
  db: Db,
  ownerId: string,
  id: string,
): Promise<Collection | undefined> {
  if (!isUuid(id)) return undefined;
  const [row] = await db
    .select()
    .from(collections)
    .where(and(eq(collections.ownerId, ownerId), eq(collections.id, id)));
  return row;
}

export async function createCollection(
  db: Db,
  ownerId: string,
  fields: CollectionFields,
): Promise<Collection> {
  const [row] = await db
    .insert(collections)
    .values({ ...fields, ownerId })
    .returning();
  return row;
}

export async function updateCollection(
  db: Db,
  ownerId: string,
  id: string,
  fields: Partial<CollectionFields> & { archived?: boolean },
): Promise<Collection | undefined> {
  if (!isUuid(id)) return undefined;
  const [row] = await db
    .update(collections)
    .set(fields)
    .where(and(eq(collections.ownerId, ownerId), eq(collections.id, id)))
    .returning();
  return row;
}
