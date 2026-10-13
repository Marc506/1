CREATE TYPE "public"."place_category" AS ENUM('restaurant', 'cafe', 'bar', 'dessert', 'bakery', 'attraction', 'museum', 'park', 'viewpoint', 'shopping', 'market', 'neighborhood', 'hotel', 'activity', 'other');--> statement-breakpoint
CREATE TYPE "public"."source_kind" AS ENUM('xiaohongshu', 'instagram', 'tiktok', 'youtube', 'dianping', 'wechat', 'friend', 'web', 'other');--> statement-breakpoint
CREATE TYPE "public"."visit_status" AS ENUM('want_to_go', 'visited', 'skipped');--> statement-breakpoint
CREATE TABLE "collection_places" (
	"collection_id" uuid NOT NULL,
	"place_id" uuid NOT NULL,
	"owner_id" text DEFAULT 'owner' NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collection_places_collection_id_place_id_pk" PRIMARY KEY("collection_id","place_id")
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text DEFAULT 'owner' NOT NULL,
	"name" text NOT NULL,
	"emoji" text,
	"color" text,
	"city_name" text,
	"center_lat" double precision,
	"center_lng" double precision,
	"bias_radius_m" integer DEFAULT 30000 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mentions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text DEFAULT 'owner' NOT NULL,
	"place_id" uuid NOT NULL,
	"why" text,
	"source_kind" "source_kind" DEFAULT 'other' NOT NULL,
	"source_url" text,
	"source_title" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "places" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text DEFAULT 'owner' NOT NULL,
	"name" text NOT NULL,
	"name_alt" text[] DEFAULT '{}'::text[] NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"formatted_address" text,
	"city" text,
	"country_code" text,
	"provider" text,
	"provider_place_id" text,
	"matched" boolean DEFAULT true NOT NULL,
	"category" "place_category" DEFAULT 'other' NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"status" "visit_status" DEFAULT 'want_to_go' NOT NULL,
	"priority" smallint DEFAULT 1 NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "search_cache" (
	"key" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"response" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "collection_places" ADD CONSTRAINT "collection_places_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_places" ADD CONSTRAINT "collection_places_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentions" ADD CONSTRAINT "mentions_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "collection_places_place_idx" ON "collection_places" USING btree ("place_id");--> statement-breakpoint
CREATE INDEX "mentions_place_idx" ON "mentions" USING btree ("place_id");--> statement-breakpoint
CREATE UNIQUE INDEX "places_owner_provider_place_uq" ON "places" USING btree ("owner_id","provider","provider_place_id") WHERE "places"."provider_place_id" is not null;--> statement-breakpoint
CREATE INDEX "places_owner_status_idx" ON "places" USING btree ("owner_id","status");--> statement-breakpoint
CREATE INDEX "places_owner_category_idx" ON "places" USING btree ("owner_id","category");--> statement-breakpoint
CREATE INDEX "search_cache_created_idx" ON "search_cache" USING btree ("created_at");