import { sql } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const PLACE_CATEGORIES = [
  "restaurant",
  "cafe",
  "bar",
  "dessert",
  "bakery",
  "attraction",
  "museum",
  "park",
  "viewpoint",
  "shopping",
  "market",
  "neighborhood",
  "hotel",
  "activity",
  "other",
] as const;
export type PlaceCategory = (typeof PLACE_CATEGORIES)[number];

export const VISIT_STATUSES = ["want_to_go", "visited", "skipped"] as const;
export type VisitStatus = (typeof VISIT_STATUSES)[number];

export const SOURCE_KINDS = [
  "xiaohongshu",
  "instagram",
  "tiktok",
  "youtube",
  "dianping",
  "wechat",
  "friend",
  "web",
  "other",
] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

export const placeCategory = pgEnum("place_category", PLACE_CATEGORIES);
export const visitStatus = pgEnum("visit_status", VISIT_STATUSES);
export const sourceKind = pgEnum("source_kind", SOURCE_KINDS);

// Phase 1 is single-user: every row belongs to 'owner'. Phase 2 swaps in a
// real user id; every server query must filter by owner_id regardless.
const ownerId = () => text("owner_id").notNull().default("owner");
const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const collections = pgTable("collections", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: ownerId(),
  name: text("name").notNull(),
  emoji: text("emoji"),
  color: text("color"),
  cityName: text("city_name"),
  centerLat: doublePrecision("center_lat"),
  centerLng: doublePrecision("center_lng"),
  biasRadiusM: integer("bias_radius_m").notNull().default(30000),
  sortOrder: integer("sort_order").notNull().default(0),
  archived: boolean("archived").notNull().default(false),
  createdAt: createdAt(),
});

export const places = pgTable(
  "places",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: ownerId(),
    name: text("name").notNull(),
    nameAlt: text("name_alt")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    formattedAddress: text("formatted_address"),
    city: text("city"),
    countryCode: text("country_code"),
    /** 'google' | 'nominatim' | 'manual' */
    provider: text("provider"),
    providerPlaceId: text("provider_place_id"),
    /** false = the user dropped the pin by hand */
    matched: boolean("matched").notNull().default(true),
    category: placeCategory("category").notNull().default("other"),
    tags: text("tags")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    status: visitStatus("status").notNull().default("want_to_go"),
    /** 0 = maybe, 1 = want to go, 2 = must go */
    priority: smallint("priority").notNull().default(1),
    note: text("note"),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("places_owner_provider_place_uq")
      .on(t.ownerId, t.provider, t.providerPlaceId)
      .where(sql`${t.providerPlaceId} is not null`),
    index("places_owner_status_idx").on(t.ownerId, t.status),
    index("places_owner_category_idx").on(t.ownerId, t.category),
  ],
);

export const collectionPlaces = pgTable(
  "collection_places",
  {
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    placeId: uuid("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    ownerId: ownerId(),
    addedAt: timestamp("added_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.collectionId, t.placeId] }),
    index("collection_places_place_idx").on(t.placeId),
  ],
);

/** Why a place is worth visiting, and where it was found. Many per place. */
export const mentions = pgTable(
  "mentions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: ownerId(),
    placeId: uuid("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    why: text("why"),
    sourceKind: sourceKind("source_kind").notNull().default("other"),
    sourceUrl: text("source_url"),
    sourceTitle: text("source_title"),
    createdAt: createdAt(),
  },
  (t) => [index("mentions_place_idx").on(t.placeId)],
);

/**
 * Provider responses keyed by sha256(provider | normalized text | bias).
 * Holds public place data only, so it is shared across owners.
 */
export const searchCache = pgTable(
  "search_cache",
  {
    key: text("key").primaryKey(),
    provider: text("provider").notNull(),
    response: jsonb("response").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("search_cache_created_idx").on(t.createdAt)],
);
