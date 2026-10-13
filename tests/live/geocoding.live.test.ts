/**
 * Calls the real providers. Run manually: RUN_LIVE=1 pnpm test:live
 * Needs network access to the provider hosts, and GOOGLE_MAPS_API_KEY for
 * Google. Each run costs one Google Text Search request.
 */
import { describe, expect, it } from "vitest";
import { GooglePlacesProvider } from "@/lib/geocoding/google";
import { NominatimProvider } from "@/lib/geocoding/nominatim";
import type { SearchQuery } from "@/lib/geocoding/provider";

const live = process.env.RUN_LIVE === "1";
const katz = { lat: 40.7222, lng: -73.9874 };
const query: SearchQuery = {
  text: "Katz's Delicatessen",
  language: "en",
  limit: 3,
  bias: { lat: 40.7128, lng: -74.006, radiusM: 30_000 },
};

function metersBetween(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const rad = Math.PI / 180;
  const x = (b.lng - a.lng) * rad * Math.cos(((a.lat + b.lat) / 2) * rad);
  const y = (b.lat - a.lat) * rad;
  return Math.sqrt(x * x + y * y) * 6_371_000;
}

describe.runIf(live && process.env.GOOGLE_MAPS_API_KEY)(
  "Google Places (live)",
  () => {
    it("finds Katz's on the Lower East Side with all Pro fields", async () => {
      const provider = new GooglePlacesProvider({
        apiKey: process.env.GOOGLE_MAPS_API_KEY!,
      });
      const [first] = await provider.search(query);
      expect(first.name).toMatch(/Katz/);
      expect(first.formattedAddress).toMatch(/Houston/);
      expect(first.mapsUri).toMatch(/^https:\/\//);
      expect(first.primaryType).toBeTruthy();
      expect(first.category).toBe("restaurant");
      expect(metersBetween(first, katz)).toBeLessThan(200);
    });
  },
);

describe.runIf(live)("Nominatim (live)", () => {
  it("finds Katz's on the Lower East Side", async () => {
    const provider = new NominatimProvider({
      userAgent: process.env.NOMINATIM_USER_AGENT,
    });
    const [first] = await provider.search(query);
    expect(first.name).toMatch(/Katz/);
    expect(metersBetween(first, katz)).toBeLessThan(200);
  });
});
