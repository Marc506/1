import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, inject, it } from "vitest";
import { createDb } from "@/lib/db/client";
import {
  collectionPlaces,
  collections,
  mentions,
  places,
} from "@/lib/db/schema";

const { db, close } = createDb(inject("databaseUrl"));

afterAll(close);

beforeEach(async () => {
  await db.execute(
    sql`truncate collections, places, collection_places, mentions, search_cache cascade`,
  );
});

const katz = {
  name: "Katz's Delicatessen",
  lat: 40.7223,
  lng: -73.9874,
  provider: "google",
  providerPlaceId: "ChIJ-katz",
  category: "restaurant" as const,
};

describe("schema", () => {
  it("applies defaults", async () => {
    const [place] = await db.insert(places).values(katz).returning();
    expect(place).toMatchObject({
      ownerId: "owner",
      status: "want_to_go",
      priority: 1,
      matched: true,
      tags: [],
      nameAlt: [],
    });
    const [collection] = await db
      .insert(collections)
      .values({ name: "纽约 2026 春假" })
      .returning();
    expect(collection).toMatchObject({ biasRadiusM: 30000, archived: false });
  });

  it("rejects the same provider place twice for one owner", async () => {
    await db.insert(places).values(katz);
    await expect(db.insert(places).values(katz)).rejects.toThrow();
  });

  it("allows the same provider place for another owner", async () => {
    await db.insert(places).values(katz);
    await db.insert(places).values({ ...katz, ownerId: "someone-else" });
    const rows = await db
      .select()
      .from(places)
      .where(eq(places.providerPlaceId, katz.providerPlaceId));
    expect(rows).toHaveLength(2);
  });

  it("allows several hand-placed pins without a provider id", async () => {
    const pin = {
      name: "Pop-up",
      lat: 40.7,
      lng: -74,
      provider: "manual",
      matched: false,
    };
    await db.insert(places).values([pin, pin]);
    const rows = await db
      .select()
      .from(places)
      .where(eq(places.provider, "manual"));
    expect(rows).toHaveLength(2);
  });

  it("cascades place deletion to links and mentions", async () => {
    const [place] = await db.insert(places).values(katz).returning();
    const [collection] = await db
      .insert(collections)
      .values({ name: "NYC" })
      .returning();
    await db
      .insert(collectionPlaces)
      .values({ collectionId: collection.id, placeId: place.id });
    await db.insert(mentions).values({
      placeId: place.id,
      why: "Pastrami",
      sourceKind: "xiaohongshu",
    });

    await db
      .delete(places)
      .where(and(eq(places.ownerId, "owner"), eq(places.id, place.id)));

    expect(await db.select().from(collectionPlaces)).toHaveLength(0);
    expect(await db.select().from(mentions)).toHaveLength(0);
    expect(await db.select().from(collections)).toHaveLength(1);
  });

  it("bumps updated_at on update", async () => {
    const [place] = await db.insert(places).values(katz).returning();
    await new Promise((r) => setTimeout(r, 10));
    const [updated] = await db
      .update(places)
      .set({ status: "visited" })
      .where(and(eq(places.ownerId, "owner"), eq(places.id, place.id)))
      .returning();
    expect(updated.updatedAt.getTime()).toBeGreaterThan(
      place.updatedAt.getTime(),
    );
  });
});
