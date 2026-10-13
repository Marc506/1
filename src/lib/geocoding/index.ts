import "server-only";
import { GooglePlacesProvider } from "./google";
import { NominatimProvider } from "./nominatim";
import type { GeocodingProvider } from "./provider";

export type { Candidate, GeocodingProvider, SearchQuery } from "./provider";
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
  });
}
