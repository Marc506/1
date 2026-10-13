import "server-only";
import { detectQueryLanguage } from "@/lib/matching/language";
import { createGeocoder, type Geocoder } from "./geocoder";
import { GooglePlacesProvider } from "./google";
import { NominatimProvider } from "./nominatim";
import type { GeocodingProvider } from "./provider";

export type { Candidate, GeocodingProvider, SearchQuery } from "./provider";
export type { SearchResult } from "./geocoder";
export { GeocodingError } from "./provider";

let nominatim: NominatimProvider | undefined;

/** Free OpenStreetMap search; also the fallback when Google fails. */
export function getFallbackProvider(): GeocodingProvider {
  nominatim ??= new NominatimProvider({
    userAgent: process.env.NOMINATIM_USER_AGENT,
  });
  return nominatim;
}

/** The provider chosen by GEOCODING_PROVIDER (default: google). */
export function getPrimaryProvider(): GeocodingProvider {
  const choice = process.env.GEOCODING_PROVIDER ?? "google";
  if (choice === "nominatim") return getFallbackProvider();
  if (choice !== "google") {
    throw new Error(`Unknown GEOCODING_PROVIDER: ${choice}`);
  }
  return new GooglePlacesProvider({
    apiKey: process.env.GOOGLE_MAPS_API_KEY ?? "",
    endpoint: process.env.GOOGLE_PLACES_ENDPOINT,
  });
}

export function getGeocoder(): Geocoder {
  return createGeocoder({
    primary: getPrimaryProvider,
    fallback: getFallbackProvider(),
    onFallback: (reason) =>
      console.warn(
        "[geocoding] falling back to Nominatim:",
        reason instanceof Error ? reason.message : reason,
      ),
  });
}

/**
 * Center of a city for search bias. Returns null when nothing is found or
 * every provider fails, so saving a collection never depends on it.
 */
export async function geocodeCity(
  cityName: string,
): Promise<{ lat: number; lng: number } | null> {
  try {
    const { candidates } = await getGeocoder().search({
      text: cityName,
      language: detectQueryLanguage(cityName),
      limit: 1,
    });
    const [first] = candidates;
    return first ? { lat: first.lat, lng: first.lng } : null;
  } catch (err) {
    console.error("[geocoding] city lookup failed:", err);
    return null;
  }
}
