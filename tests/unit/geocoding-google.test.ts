import { describe, expect, it, vi } from "vitest";
import {
  buildGoogleTextSearchBody,
  GOOGLE_FIELD_MASK,
  GOOGLE_TEXT_SEARCH_URL,
  GooglePlacesProvider,
  parseGoogleTextSearch,
} from "@/lib/geocoding/google";
import { GeocodingError, type SearchQuery } from "@/lib/geocoding/provider";
import empty from "../fixtures/google/text-search-empty.json";
import incomplete from "../fixtures/google/text-search-incomplete.json";
import katz from "../fixtures/google/text-search-katz.json";
import zh from "../fixtures/google/text-search-zh.json";

const nyc = { lat: 40.7128, lng: -74.006, radiusM: 30_000 };
const query: SearchQuery = {
  text: "Katz's",
  language: "en",
  limit: 5,
  bias: nyc,
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("buildGoogleTextSearchBody", () => {
  it("includes the location bias and page size", () => {
    expect(buildGoogleTextSearchBody(query)).toEqual({
      textQuery: "Katz's",
      languageCode: "en",
      pageSize: 5,
      locationBias: {
        circle: {
          center: { latitude: 40.7128, longitude: -74.006 },
          radius: 30_000,
        },
      },
    });
  });

  it("caps the radius at 50 km and the page size at 5", () => {
    const body = buildGoogleTextSearchBody({
      ...query,
      limit: 20,
      bias: { ...nyc, radiusM: 200_000 },
    });
    expect(body.pageSize).toBe(5);
    expect(body.locationBias?.circle.radius).toBe(50_000);
  });

  it("omits bias and region when absent, includes region when given", () => {
    const body = buildGoogleTextSearchBody({
      text: "x",
      language: "zh-CN",
      limit: 3,
    });
    expect(body).toEqual({
      textQuery: "x",
      languageCode: "zh-CN",
      pageSize: 3,
    });
    expect(
      buildGoogleTextSearchBody({
        text: "x",
        language: "en",
        limit: 3,
        region: "US",
      }),
    ).toMatchObject({ regionCode: "US" });
  });
});

describe("parseGoogleTextSearch", () => {
  it("maps places to candidates", () => {
    expect(parseGoogleTextSearch(katz)).toEqual([
      {
        provider: "google",
        providerPlaceId: "fixture-google-katz",
        name: "Katz's Delicatessen",
        formattedAddress: "205 E Houston St, New York, NY 10002, USA",
        lat: 40.7222319,
        lng: -73.9873866,
        primaryType: "deli",
        category: "restaurant",
        mapsUri: "https://maps.google.com/?cid=1000000000000000001",
      },
      expect.objectContaining({
        providerPlaceId: "fixture-google-katz-shop",
        category: "shopping",
      }),
    ]);
  });

  it("keeps localized names and maps categories", () => {
    const [lilia, moma] = parseGoogleTextSearch(zh);
    expect(lilia).toMatchObject({ name: "Lilia", category: "restaurant" });
    expect(moma).toMatchObject({ name: "现代艺术博物馆", category: "museum" });
  });

  it("returns [] for an empty response", () => {
    expect(parseGoogleTextSearch(empty)).toEqual([]);
    expect(parseGoogleTextSearch(null)).toEqual([]);
  });

  it("skips places without id, name or location", () => {
    expect(parseGoogleTextSearch(incomplete)).toEqual([
      {
        provider: "google",
        providerPlaceId: "fixture-minimal",
        name: "Minimal",
        formattedAddress: "",
        lat: 40.7,
        lng: -74,
        primaryType: undefined,
        category: "other",
        mapsUri: undefined,
      },
    ]);
  });
});

describe("GooglePlacesProvider", () => {
  it("sends the key and the Pro-only field mask", async () => {
    const fetch = vi.fn(async () => jsonResponse(katz));
    const provider = new GooglePlacesProvider({ apiKey: "test-key", fetch });

    const results = await provider.search(query);

    expect(results.map((r) => r.name)).toEqual([
      "Katz's Delicatessen",
      "Katz's Merch Shop",
    ]);
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(GOOGLE_TEXT_SEARCH_URL);
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      "X-Goog-Api-Key": "test-key",
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.location,places.types,places.primaryType,places.googleMapsUri",
    });
    expect(JSON.parse(init.body as string)).toEqual(
      buildGoogleTextSearchBody(query),
    );
  });

  it("never asks for Enterprise-tier fields", () => {
    for (const field of [
      "rating",
      "regularOpeningHours",
      "priceLevel",
      "reviews",
      "websiteUri",
    ]) {
      expect(GOOGLE_FIELD_MASK).not.toContain(field);
    }
  });

  it("truncates to the requested limit", async () => {
    const provider = new GooglePlacesProvider({
      apiKey: "k",
      fetch: async () => jsonResponse(katz),
    });
    expect(await provider.search({ ...query, limit: 1 })).toHaveLength(1);
  });

  it.each([
    [429, true],
    [500, true],
    [503, true],
    [400, false],
    [403, false],
  ])("HTTP %i -> GeocodingError(retryable=%s)", async (status, retryable) => {
    const provider = new GooglePlacesProvider({
      apiKey: "k",
      fetch: async () => jsonResponse({ error: { status: "X" } }, status),
    });
    const err = await provider.search(query).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(GeocodingError);
    expect(err).toMatchObject({ provider: "google", status, retryable });
  });

  it("treats network failures as retryable", async () => {
    const provider = new GooglePlacesProvider({
      apiKey: "k",
      fetch: async () => {
        throw new TypeError("fetch failed");
      },
    });
    await expect(provider.search(query)).rejects.toMatchObject({
      name: "GeocodingError",
      retryable: true,
    });
  });

  it("requires an API key", () => {
    expect(() => new GooglePlacesProvider({ apiKey: "" })).toThrow(
      /GOOGLE_MAPS_API_KEY/,
    );
  });
});
