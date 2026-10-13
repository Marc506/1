import type { PlaceCategory } from "@/lib/db/schema";

export type ProviderId = "google" | "nominatim" | "apple";

export type SearchQuery = {
  /** What the user typed. */
  text: string;
  /** Usually the collection's city center. */
  bias?: { lat: number; lng: number; radiusM: number };
  language: "zh-CN" | "en";
  /** CLDR region code such as "US". Optional. */
  region?: string;
  /** At most 5. */
  limit: number;
};

export type Candidate = {
  provider: ProviderId;
  providerPlaceId: string;
  name: string;
  formattedAddress: string;
  lat: number;
  lng: number;
  /** The provider's own type, e.g. Google's primaryType. */
  primaryType?: string;
  /** Mapped to our local categories. */
  category: PlaceCategory;
  /** Google Maps link supplied by the provider, if any. */
  mapsUri?: string;
};

export interface GeocodingProvider {
  readonly id: ProviderId;
  search(q: SearchQuery): Promise<Candidate[]>;
}

export const MAX_RESULTS = 5;

export class GeocodingError extends Error {
  constructor(
    message: string,
    readonly provider: ProviderId,
    /** Rate limits and server errors: worth falling back to another provider. */
    readonly retryable: boolean,
    readonly status?: number,
  ) {
    super(message);
    this.name = "GeocodingError";
  }
}

export type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

export function clampLimit(limit: number): number {
  return Math.max(1, Math.min(MAX_RESULTS, Math.floor(limit)));
}

export function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}
