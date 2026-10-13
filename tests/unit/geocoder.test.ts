import { describe, expect, it, vi } from "vitest";
import { createGeocoder } from "@/lib/geocoding/geocoder";
import {
  GeocodingError,
  type Candidate,
  type GeocodingProvider,
  type ProviderId,
} from "@/lib/geocoding/provider";
import { detectQueryLanguage } from "@/lib/matching/language";

const q = { text: "Katz's", language: "en" as const, limit: 5 };

function candidate(provider: ProviderId): Candidate {
  return {
    provider,
    providerPlaceId: `${provider}-1`,
    name: "Katz's",
    formattedAddress: "",
    lat: 1,
    lng: 2,
    category: "restaurant",
  };
}

function provider(
  id: ProviderId,
  search: GeocodingProvider["search"],
): GeocodingProvider {
  return { id, search: vi.fn(search) };
}

const okFallback = () =>
  provider("nominatim", async () => [candidate("nominatim")]);

describe("createGeocoder", () => {
  it("uses the primary provider when it answers", async () => {
    const fallback = okFallback();
    const geocoder = createGeocoder({
      primary: () => provider("google", async () => [candidate("google")]),
      fallback,
    });
    expect(await geocoder.search(q)).toMatchObject({
      provider: "google",
      usedFallback: false,
    });
    expect(fallback.search).not.toHaveBeenCalled();
  });

  it("falls back on a retryable error", async () => {
    const onFallback = vi.fn();
    const geocoder = createGeocoder({
      primary: () =>
        provider("google", async () => {
          throw new GeocodingError("429", "google", true, 429);
        }),
      fallback: okFallback(),
      onFallback,
    });
    expect(await geocoder.search(q)).toMatchObject({
      provider: "nominatim",
      usedFallback: true,
      candidates: [{ provider: "nominatim" }],
    });
    expect(onFallback).toHaveBeenCalledOnce();
  });

  it("falls back when the primary cannot be created (no API key)", async () => {
    const geocoder = createGeocoder({
      primary: () => {
        throw new Error("GOOGLE_MAPS_API_KEY is not set");
      },
      fallback: okFallback(),
    });
    expect(await geocoder.search(q)).toMatchObject({ usedFallback: true });
  });

  it("does not hide a non-retryable error such as a rejected key", async () => {
    const geocoder = createGeocoder({
      primary: () =>
        provider("google", async () => {
          throw new GeocodingError("403", "google", false, 403);
        }),
      fallback: okFallback(),
    });
    await expect(geocoder.search(q)).rejects.toMatchObject({ status: 403 });
  });

  it("does not retry the same provider as its own fallback", async () => {
    const failing = provider("nominatim", async () => {
      throw new GeocodingError("503", "nominatim", true, 503);
    });
    const geocoder = createGeocoder({
      primary: () => failing,
      fallback: failing,
    });
    await expect(geocoder.search(q)).rejects.toMatchObject({ status: 503 });
    expect(failing.search).toHaveBeenCalledOnce();
  });
});

describe("detectQueryLanguage", () => {
  it.each([
    ["Katz's", "en"],
    ["205 E Houston St", "en"],
    ["纽约 Lilia 意面", "zh-CN"],
    ["東京タワー", "zh-CN"],
    ["Café de Flore", "en"],
  ] as const)("%s -> %s", (text, expected) => {
    expect(detectQueryLanguage(text)).toBe(expected);
  });
});
