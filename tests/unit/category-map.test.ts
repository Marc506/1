import { describe, expect, it } from "vitest";
import {
  categoryFromGoogleTypes,
  categoryFromOsm,
} from "@/lib/matching/category-map";

describe("categoryFromGoogleTypes", () => {
  it.each([
    ["italian_restaurant", [], "restaurant"],
    ["dessert_restaurant", ["restaurant"], "dessert"],
    ["coffee_shop", [], "cafe"],
    ["wine_bar", [], "bar"],
    ["bakery", ["cafe"], "bakery"],
    ["art_museum", [], "museum"],
    ["observation_deck", ["tourist_attraction"], "viewpoint"],
    ["clothing_store", [], "shopping"],
    ["farmers_market", [], "market"],
    ["lodging", [], "hotel"],
    ["movie_theater", [], "activity"],
  ] as const)("%s -> %s", (primary, types, expected) => {
    expect(categoryFromGoogleTypes(primary, types)).toBe(expected);
  });

  it("falls back to `types` when the primary type is unknown or missing", () => {
    expect(
      categoryFromGoogleTypes("unknown_type", ["park", "establishment"]),
    ).toBe("park");
    expect(
      categoryFromGoogleTypes(undefined, ["point_of_interest", "museum"]),
    ).toBe("museum");
  });

  it("returns other when nothing maps", () => {
    expect(
      categoryFromGoogleTypes(undefined, [
        "point_of_interest",
        "establishment",
      ]),
    ).toBe("other");
    expect(categoryFromGoogleTypes(undefined)).toBe("other");
  });
});

describe("categoryFromOsm", () => {
  it.each([
    ["amenity", "restaurant", "restaurant"],
    ["amenity", "cafe", "cafe"],
    ["amenity", "ice_cream", "dessert"],
    ["shop", "bakery", "bakery"],
    ["shop", "books", "shopping"],
    ["tourism", "museum", "museum"],
    ["tourism", "viewpoint", "viewpoint"],
    ["leisure", "park", "park"],
    ["leisure", "bowling_alley", "activity"],
    ["place", "neighbourhood", "neighborhood"],
    ["boundary", "administrative", "other"],
  ])("%s=%s -> %s", (cls, type, expected) => {
    expect(categoryFromOsm(cls, type)).toBe(expected);
  });
});
