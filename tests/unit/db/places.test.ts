import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, inject, it, vi } from "vitest";
import { createDb } from "@/lib/db/client";
import { createCollection } from "@/lib/db/queries/collections";
import {
  addMention,
  collectionFacets,
  deleteMention,
  deletePlace,
  getPlaceDetail,
  listCollectionPlaces,
  mostRecentPlaceCoords,
  removePlaceFromCollection,
  savePlaceToCollection,
  updatePlace,
  type SavePlaceInput,
} from "@/lib/db/queries/places";
import { mentions, places, searchCache } from "@/lib/db/schema";
import {
  readSearchCache,
  searchCacheKey,
  SEARCH_CACHE_TTL_MS,
  writeSearchCache,
} from "@/lib/geocoding/cache";
import type { Geocoder } from "@/lib/geocoding/geocoder";
import type { Candidate } from "@/lib/geocoding/provider";
import { searchForCollection } from "@/lib/geocoding/search";

const { db, close } = createDb(inject("databaseUrl"));
afterAll(close);

beforeEach(async () => {
  await db.execute(
    sql`truncate collections, places, collection_places, mentions, search_cache cascade`,
  );
});

const nycFields = {
  name: "NYC",
  emoji: null,
  cityName: "New York",
  centerLat: 40.7128,
  centerLng: -74.006,
};

const katz: Candidate = {
  provider: "google",
  providerPlaceId: "g-katz",
  name: "Katz's Delicatessen",
  formattedAddress: "205 E Houston St",
  lat: 40.7223,
  lng: -73.9874,
  category: "restaurant",
};

function input(
  collectionId: string,
  extra: Partial<SavePlaceInput> = {},
): SavePlaceInput {
  return {
    collectionId,
    place: { ...katz, formattedAddress: katz.formattedAddress },
    ...extra,
  };
}

describe("savePlaceToCollection", () => {
  it("creates the place, links it and records the reason", async () => {
    const col = await createCollection(db, "alice", nycFields);
    const result = await savePlaceToCollection(
      db,
      "alice",
      input(col.id, {
        why: "Pastrami",
        sourceUrl: "https://example.com/p/1",
        sourceKind: "xiaohongshu",
        tags: ["deli"],
        priority: 2,
        note: "cash only",
      }),
    );
    expect(result).toMatchObject({
      ok: true,
      existing: false,
      alreadyInCollection: false,
    });

    const listed = await listCollectionPlaces(db, "alice", col.id);
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({
      name: "Katz's Delicatessen",
      tags: ["deli"],
      priority: 2,
      note: "cash only",
      matched: true,
      mentionCount: 1,
    });
  });

  it("reuses an existing place: appends the reason and links it to another collection", async () => {
    const nyc = await createCollection(db, "alice", nycFields);
    const food = await createCollection(db, "alice", {
      ...nycFields,
      name: "Food",
    });
    const first = await savePlaceToCollection(
      db,
      "alice",
      input(nyc.id, { why: "A", tags: ["deli"] }),
    );
    const second = await savePlaceToCollection(
      db,
      "alice",
      input(food.id, { why: "B", tags: ["late night"], note: "new note" }),
    );

    expect(second).toMatchObject({
      ok: true,
      existing: true,
      alreadyInCollection: false,
    });
    if (!first.ok || !second.ok) throw new Error("unreachable");
    expect(second.placeId).toBe(first.placeId);
    expect(await db.select().from(places)).toHaveLength(1);
    const [place] = await db.select().from(places);
    expect(place.tags).toEqual(["deli", "late night"]);
    expect(place.note).toBe("new note");
    expect(
      await db
        .select()
        .from(mentions)
        .where(eq(mentions.placeId, first.placeId)),
    ).toHaveLength(2);
    expect(await listCollectionPlaces(db, "alice", food.id)).toHaveLength(1);
  });

  it("reports when the place is already in the same collection", async () => {
    const col = await createCollection(db, "alice", nycFields);
    await savePlaceToCollection(db, "alice", input(col.id));
    const again = await savePlaceToCollection(db, "alice", input(col.id));
    expect(again).toMatchObject({
      ok: true,
      existing: true,
      alreadyInCollection: true,
    });
  });

  it("does not record an empty mention", async () => {
    const col = await createCollection(db, "alice", nycFields);
    await savePlaceToCollection(db, "alice", input(col.id));
    expect(await db.select().from(mentions)).toHaveLength(0);
  });

  it("keeps owners apart", async () => {
    const aliceCol = await createCollection(db, "alice", nycFields);
    const bobCol = await createCollection(db, "bob", nycFields);
    await savePlaceToCollection(db, "alice", input(aliceCol.id));
    const bob = await savePlaceToCollection(db, "bob", input(bobCol.id));
    expect(bob).toMatchObject({ existing: false });
    expect(await savePlaceToCollection(db, "bob", input(aliceCol.id))).toEqual({
      ok: false,
      error: "collection_not_found",
    });
    expect(await listCollectionPlaces(db, "bob", aliceCol.id)).toEqual([]);
  });

  it("saves hand-placed pins without deduplicating them", async () => {
    const col = await createCollection(db, "alice", nycFields);
    const pin = {
      collectionId: col.id,
      place: {
        provider: "manual",
        providerPlaceId: null,
        name: "Pop-up",
        formattedAddress: null,
        lat: 40.7,
        lng: -74,
        category: "other" as const,
      },
    };
    await savePlaceToCollection(db, "alice", pin);
    await savePlaceToCollection(db, "alice", pin);
    const rows = await listCollectionPlaces(db, "alice", col.id);
    expect(rows).toHaveLength(2);
    expect(rows[0].matched).toBe(false);
  });

  it("gives the most recent place for bias", async () => {
    const col = await createCollection(db, "alice", nycFields);
    expect(await mostRecentPlaceCoords(db, "alice")).toBeUndefined();
    await savePlaceToCollection(db, "alice", input(col.id));
    expect(await mostRecentPlaceCoords(db, "alice")).toEqual({
      lat: katz.lat,
      lng: katz.lng,
    });
  });
});

describe("search cache", () => {
  it("returns fresh entries and ignores expired ones", async () => {
    const key = searchCacheKey("google", { text: "Katz's", language: "en" });
    await writeSearchCache(db, key, "google", [katz]);
    expect(await readSearchCache(db, key)).toEqual([katz]);
    const later = new Date(Date.now() + SEARCH_CACHE_TTL_MS + 60_000);
    expect(await readSearchCache(db, key, later)).toBeUndefined();
  });

  it("keys on provider, language, case-folded text and rounded bias", () => {
    const base = { text: "Katz's", language: "en" as const };
    const k = searchCacheKey("google", base);
    expect(searchCacheKey("google", { ...base, text: "KATZ'S" })).toBe(k);
    expect(searchCacheKey("nominatim", base)).not.toBe(k);
    expect(searchCacheKey("google", { ...base, language: "zh-CN" })).not.toBe(
      k,
    );
    const bias = { lat: 40.71281, lng: -74.00601, radiusM: 30_000 };
    expect(searchCacheKey("google", { ...base, bias })).toBe(
      searchCacheKey("google", { ...base, bias: { ...bias, lat: 40.71279 } }),
    );
  });
});

describe("searchForCollection", () => {
  function fakeGeocoder(
    usedFallback = false,
  ): Geocoder & { search: ReturnType<typeof vi.fn> } {
    return {
      search: vi.fn(async () => ({
        candidates: [katz],
        provider: usedFallback ? ("nominatim" as const) : ("google" as const),
        usedFallback,
      })),
    };
  }

  it("biases to the collection center and caches the answer", async () => {
    const col = await createCollection(db, "alice", nycFields);
    const geocoder = fakeGeocoder();
    const deps = { db, geocoder, primaryProvider: "google" as const };

    const first = await searchForCollection(deps, "alice", {
      text: "  Katz’s ",
      collectionId: col.id,
    });
    expect(first).toMatchObject({
      ok: true,
      query: "Katz’s",
      cached: false,
      bias: {
        lat: 40.7128,
        lng: -74.006,
        radiusM: 30_000,
        source: "collection",
      },
    });
    expect(geocoder.search).toHaveBeenCalledWith(
      expect.objectContaining({ text: "Katz’s", language: "en", limit: 5 }),
    );

    const second = await searchForCollection(deps, "alice", {
      text: "Katz’s",
      collectionId: col.id,
    });
    expect(second).toMatchObject({ ok: true, cached: true });
    expect(geocoder.search).toHaveBeenCalledTimes(1);
    if (!second.ok) throw new Error("unreachable");
    expect(second.candidates[0].distanceM).toBeGreaterThan(0);
  });

  it("uses the last saved place when the collection has no center", async () => {
    const col = await createCollection(db, "alice", {
      ...nycFields,
      centerLat: null,
      centerLng: null,
    });
    const deps = {
      db,
      geocoder: fakeGeocoder(),
      primaryProvider: "google" as const,
    };
    const none = await searchForCollection(deps, "alice", {
      text: "Katz",
      collectionId: col.id,
    });
    expect(none).toMatchObject({ ok: true, bias: null });

    await savePlaceToCollection(db, "alice", input(col.id));
    const recent = await searchForCollection(deps, "alice", {
      text: "Lilia",
      collectionId: col.id,
    });
    expect(recent).toMatchObject({
      ok: true,
      bias: { source: "recent", lat: katz.lat },
    });
  });

  it("detects Chinese queries and does not cache fallback answers", async () => {
    const col = await createCollection(db, "alice", nycFields);
    const geocoder = fakeGeocoder(true);
    const deps = { db, geocoder, primaryProvider: "google" as const };
    const result = await searchForCollection(deps, "alice", {
      text: "纽约 Lilia 意面",
      collectionId: col.id,
    });
    expect(result).toMatchObject({
      ok: true,
      usedFallback: true,
      provider: "nominatim",
    });
    expect(geocoder.search).toHaveBeenCalledWith(
      expect.objectContaining({ language: "zh-CN" }),
    );
    expect(await db.select().from(searchCache)).toHaveLength(0);
  });

  it("rejects short queries and other owners' collections", async () => {
    const col = await createCollection(db, "alice", nycFields);
    const deps = {
      db,
      geocoder: fakeGeocoder(),
      primaryProvider: "google" as const,
    };
    expect(
      await searchForCollection(deps, "alice", {
        text: " k ",
        collectionId: col.id,
      }),
    ).toEqual({
      ok: false,
      error: "query_too_short",
    });
    expect(
      await searchForCollection(deps, "bob", {
        text: "Katz",
        collectionId: col.id,
      }),
    ).toEqual({
      ok: false,
      error: "collection_not_found",
    });
  });
});

describe("listCollectionPlaces filters and facets", () => {
  async function seed() {
    const col = await createCollection(db, "alice", nycFields);
    const add = (
      name: string,
      category: Candidate["category"],
      extra: Partial<SavePlaceInput> = {},
    ) =>
      savePlaceToCollection(db, "alice", {
        collectionId: col.id,
        place: { ...katz, providerPlaceId: `g-${name}`, name, category },
        ...extra,
      });
    await add("b Katz", "restaurant", {
      tags: ["deli", "late night"],
      priority: 1,
    });
    await add("Abraço", "cafe", { tags: ["coffee"], priority: 2 });
    await add("Lilia", "restaurant", { tags: ["late night"], priority: 0 });
    await db
      .update(places)
      .set({ status: "visited" })
      .where(eq(places.name, "Lilia"));
    return col;
  }

  it("filters by category, status and tag", async () => {
    const col = await seed();
    const names = async (opts: Parameters<typeof listCollectionPlaces>[3]) =>
      (await listCollectionPlaces(db, "alice", col.id, opts)).map(
        (p) => p.name,
      );

    expect(await names({ category: "restaurant" })).toEqual([
      "Lilia",
      "b Katz",
    ]);
    expect(await names({ status: "visited" })).toEqual(["Lilia"]);
    expect(await names({ tag: "late night" })).toEqual(["Lilia", "b Katz"]);
    expect(await names({ tag: "late night", status: "want_to_go" })).toEqual([
      "b Katz",
    ]);
    expect(await names({ category: "cafe", tag: "deli" })).toEqual([]);
  });

  it("sorts by recent, priority and name", async () => {
    const col = await seed();
    const names = async (sort: "recent" | "priority" | "name") =>
      (await listCollectionPlaces(db, "alice", col.id, { sort })).map(
        (p) => p.name,
      );
    expect(await names("recent")).toEqual(["Lilia", "Abraço", "b Katz"]);
    expect(await names("priority")).toEqual(["Abraço", "b Katz", "Lilia"]);
    expect(await names("name")).toEqual(["Abraço", "b Katz", "Lilia"]);
  });

  it("counts facets for the whole collection", async () => {
    const col = await seed();
    expect(await collectionFacets(db, "alice", col.id)).toEqual({
      total: 3,
      categories: [
        { value: "restaurant", count: 2 },
        { value: "cafe", count: 1 },
      ],
      statuses: [
        { value: "visited", count: 1 },
        { value: "want_to_go", count: 2 },
      ].sort((a, b) => b.count - a.count || a.value.localeCompare(b.value)),
      tags: [
        { value: "late night", count: 2 },
        { value: "coffee", count: 1 },
        { value: "deli", count: 1 },
      ],
    });
    expect(await collectionFacets(db, "bob", col.id)).toMatchObject({
      total: 0,
    });
  });
});

describe("place detail and edits", () => {
  async function seedOne() {
    const col = await createCollection(db, "alice", nycFields);
    const saved = await savePlaceToCollection(
      db,
      "alice",
      input(col.id, { why: "Pastrami" }),
    );
    if (!saved.ok) throw new Error("unreachable");
    return { col, placeId: saved.placeId };
  }

  it("reads a place with its mentions and collections, for its owner only", async () => {
    const { col, placeId } = await seedOne();
    const detail = await getPlaceDetail(db, "alice", placeId);
    expect(detail).toMatchObject({
      name: "Katz's Delicatessen",
      mentions: [{ why: "Pastrami" }],
      collections: [{ id: col.id, name: "NYC" }],
    });
    expect(await getPlaceDetail(db, "bob", placeId)).toBeUndefined();
    expect(await getPlaceDetail(db, "alice", "nope")).toBeUndefined();
  });

  it("updates fields only for the owner", async () => {
    const { placeId } = await seedOne();
    expect(await updatePlace(db, "bob", placeId, { status: "visited" })).toBe(
      false,
    );
    expect(
      await updatePlace(db, "alice", placeId, {
        status: "visited",
        priority: 2,
        tags: ["x"],
      }),
    ).toBe(true);
    expect(await getPlaceDetail(db, "alice", placeId)).toMatchObject({
      status: "visited",
      priority: 2,
      tags: ["x"],
    });
    expect(await updatePlace(db, "alice", placeId, {})).toBe(false);
  });

  it("adds and deletes mentions for the owner only", async () => {
    const { placeId } = await seedOne();
    expect(
      await addMention(db, "bob", placeId, {
        why: "x",
        sourceKind: "web",
        sourceUrl: null,
      }),
    ).toBe(false);
    expect(
      await addMention(db, "alice", placeId, {
        why: null,
        sourceKind: "web",
        sourceUrl: "https://e.com",
      }),
    ).toBe(true);
    const detail = await getPlaceDetail(db, "alice", placeId);
    expect(detail?.mentions).toHaveLength(2);
    const id = detail!.mentions[0].id;
    expect(await deleteMention(db, "bob", id)).toBe(false);
    expect(await deleteMention(db, "alice", id)).toBe(true);
    expect((await getPlaceDetail(db, "alice", placeId))?.mentions).toHaveLength(
      1,
    );
  });

  it("removes from a collection and deletes the place", async () => {
    const { col, placeId } = await seedOne();
    expect(await removePlaceFromCollection(db, "bob", placeId, col.id)).toBe(
      false,
    );
    expect(await removePlaceFromCollection(db, "alice", placeId, col.id)).toBe(
      true,
    );
    expect(await listCollectionPlaces(db, "alice", col.id)).toEqual([]);
    expect(await getPlaceDetail(db, "alice", placeId)).toBeDefined();

    expect(await deletePlace(db, "bob", placeId)).toBe(false);
    expect(await deletePlace(db, "alice", placeId)).toBe(true);
    expect(await getPlaceDetail(db, "alice", placeId)).toBeUndefined();
    expect(await db.select().from(mentions)).toHaveLength(0);
  });
});
