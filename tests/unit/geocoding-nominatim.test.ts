import { describe, expect, it, vi } from "vitest";
import {
  buildNominatimUrl,
  NominatimProvider,
  parseNominatim,
  viewboxFor,
} from "@/lib/geocoding/nominatim";
import { GeocodingError } from "@/lib/geocoding/provider";
import katz from "../fixtures/nominatim/search-katz.json";

const nyc = { lat: 40.7128, lng: -74.006, radiusM: 30_000 };

describe("buildNominatimUrl", () => {
  it("builds a jsonv2 query with language, limit and a soft viewbox", () => {
    const url = new URL(
      buildNominatimUrl({
        text: "Katz's",
        language: "zh-CN",
        limit: 9,
        bias: nyc,
        region: "US",
      }),
    );
    expect(url.origin + url.pathname).toBe(
      "https://nominatim.openstreetmap.org/search",
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({
      q: "Katz's",
      format: "jsonv2",
      limit: "5",
      "accept-language": "zh-CN",
      countrycodes: "us",
      viewbox: viewboxFor(nyc),
      bounded: "0",
    });
  });
});

describe("viewboxFor", () => {
  it("covers the radius around the center", () => {
    const [west, north, east, south] = viewboxFor(nyc).split(",").map(Number);
    expect(north - nyc.lat).toBeCloseTo(0.2695, 3);
    expect(nyc.lat - south).toBeCloseTo(0.2695, 3);
    // Longitude degrees are shorter at 40.7°N, so the box is wider.
    expect(east - nyc.lng).toBeCloseTo(0.3557, 3);
    expect(nyc.lng - west).toBeCloseTo(0.3557, 3);
  });
});

describe("parseNominatim", () => {
  it("maps results, uses OSM ids and falls back to display_name", () => {
    expect(parseNominatim(katz)).toEqual([
      {
        provider: "nominatim",
        providerPlaceId: "N2000000001",
        name: "Katz's Delicatessen",
        formattedAddress:
          "Katz's Delicatessen, 205, East Houston Street, Lower East Side, Manhattan, New York County, New York, 10002, United States",
        lat: 40.7223,
        lng: -73.9874,
        primaryType: "amenity=restaurant",
        category: "restaurant",
      },
      expect.objectContaining({
        providerPlaceId: "W3000000001",
        name: "Central Park",
        category: "park",
      }),
    ]);
  });

  it("returns [] for anything that is not an array", () => {
    expect(parseNominatim({ error: "x" })).toEqual([]);
  });
});

describe("NominatimProvider", () => {
  it("sends an identifying User-Agent", async () => {
    const fetch = vi.fn(async () => Response.json(katz));
    const provider = new NominatimProvider({ fetch, minIntervalMs: 0 });
    const results = await provider.search({
      text: "Katz's",
      language: "en",
      limit: 5,
    });
    expect(results).toHaveLength(2);
    const init = (fetch.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect((init.headers as Record<string, string>)["User-Agent"]).toMatch(
      /^PlaceBook\//,
    );
  });

  it("spaces requests out", async () => {
    const times: number[] = [];
    const provider = new NominatimProvider({
      minIntervalMs: 60,
      fetch: async () => {
        times.push(Date.now());
        return Response.json([]);
      },
    });
    const q = { text: "x", language: "en" as const, limit: 1 };
    await Promise.all([
      provider.search(q),
      provider.search(q),
      provider.search(q),
    ]);
    expect(times[1] - times[0]).toBeGreaterThanOrEqual(55);
    expect(times[2] - times[1]).toBeGreaterThanOrEqual(55);
  });

  it("raises a retryable error on 429", async () => {
    const provider = new NominatimProvider({
      minIntervalMs: 0,
      fetch: async () => new Response("slow down", { status: 429 }),
    });
    const err = await provider
      .search({ text: "x", language: "en", limit: 1 })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(GeocodingError);
    expect(err).toMatchObject({
      provider: "nominatim",
      retryable: true,
      status: 429,
    });
  });
});
