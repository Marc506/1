import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, inject, it } from "vitest";
import { createDb } from "@/lib/db/client";
import {
  countArchivedCollections,
  createCollection,
  getCollection,
  listCollections,
  updateCollection,
} from "@/lib/db/queries/collections";
import { collectionPlaces, places } from "@/lib/db/schema";

const { db, close } = createDb(inject("databaseUrl"));
afterAll(close);

beforeEach(async () => {
  await db.execute(
    sql`truncate collections, places, collection_places, mentions cascade`,
  );
});

const nyc = {
  name: "纽约 2026 春假",
  emoji: "🗽",
  cityName: "New York",
  centerLat: 40.7128,
  centerLng: -74.006,
};
const blank = {
  name: "Someday",
  emoji: null,
  cityName: null,
  centerLat: null,
  centerLng: null,
};

describe("collection queries", () => {
  it("creates and reads back a collection for its owner only", async () => {
    const created = await createCollection(db, "alice", nyc);
    expect(created).toMatchObject({
      ...nyc,
      ownerId: "alice",
      archived: false,
    });

    expect(await getCollection(db, "alice", created.id)).toMatchObject(nyc);
    expect(await getCollection(db, "bob", created.id)).toBeUndefined();
  });

  it("treats a malformed id as not found instead of throwing", async () => {
    expect(await getCollection(db, "alice", "not-a-uuid")).toBeUndefined();
    expect(
      await updateCollection(db, "alice", "not-a-uuid", { name: "x" }),
    ).toBeUndefined();
  });

  it("lists active and archived collections separately, newest first", async () => {
    const first = await createCollection(db, "alice", blank);
    await new Promise((r) => setTimeout(r, 5));
    const second = await createCollection(db, "alice", nyc);
    await createCollection(db, "bob", { ...blank, name: "Bob's" });

    expect((await listCollections(db, "alice")).map((c) => c.id)).toEqual([
      second.id,
      first.id,
    ]);

    await updateCollection(db, "alice", first.id, { archived: true });
    expect((await listCollections(db, "alice")).map((c) => c.id)).toEqual([
      second.id,
    ]);
    expect(
      (await listCollections(db, "alice", { archived: true })).map((c) => c.id),
    ).toEqual([first.id]);
    expect(await countArchivedCollections(db, "alice")).toBe(1);
    expect(await countArchivedCollections(db, "bob")).toBe(0);
  });

  it("counts places per collection", async () => {
    const c = await createCollection(db, "alice", nyc);
    const empty = await createCollection(db, "alice", blank);
    const rows = await db
      .insert(places)
      .values([
        { ownerId: "alice", name: "A", lat: 1, lng: 1 },
        { ownerId: "alice", name: "B", lat: 2, lng: 2 },
      ])
      .returning();
    await db.insert(collectionPlaces).values(
      rows.map((p) => ({
        ownerId: "alice",
        collectionId: c.id,
        placeId: p.id,
      })),
    );

    const counts = Object.fromEntries(
      (await listCollections(db, "alice")).map((x) => [x.id, x.placeCount]),
    );
    expect(counts).toEqual({ [c.id]: 2, [empty.id]: 0 });
  });

  it("only updates the owner's own collection", async () => {
    const c = await createCollection(db, "alice", nyc);
    expect(
      await updateCollection(db, "bob", c.id, { name: "hijacked" }),
    ).toBeUndefined();
    const updated = await updateCollection(db, "alice", c.id, {
      name: "NYC",
      cityName: null,
      centerLat: null,
      centerLng: null,
    });
    expect(updated).toMatchObject({
      name: "NYC",
      cityName: null,
      centerLat: null,
    });
  });
});
