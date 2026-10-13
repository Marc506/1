import { categoryFromGoogleTypes } from "@/lib/matching/category-map";
import {
  clampLimit,
  GeocodingError,
  isRetryableStatus,
  type Candidate,
  type FetchLike,
  type GeocodingProvider,
  type SearchQuery,
} from "./provider";

export const GOOGLE_TEXT_SEARCH_URL =
  "https://places.googleapis.com/v1/places:searchText";

/**
 * Only fields billed at the Text Search Pro SKU. Ratings, opening hours and
 * the like would raise every request to the Enterprise SKU.
 */
export const GOOGLE_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.types",
  "places.primaryType",
  "places.googleMapsUri",
].join(",");

/** Places API (New) caps a location bias circle at 50 km. */
const MAX_BIAS_RADIUS_M = 50_000;

type GooglePlace = {
  id?: string;
  displayName?: { text?: string; languageCode?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  types?: string[];
  primaryType?: string;
  googleMapsUri?: string;
};

export function buildGoogleTextSearchBody(q: SearchQuery) {
  return {
    textQuery: q.text,
    languageCode: q.language,
    pageSize: clampLimit(q.limit),
    ...(q.region ? { regionCode: q.region } : {}),
    ...(q.bias
      ? {
          locationBias: {
            circle: {
              center: { latitude: q.bias.lat, longitude: q.bias.lng },
              radius: Math.min(q.bias.radiusM, MAX_BIAS_RADIUS_M),
            },
          },
        }
      : {}),
  };
}

/** Maps a Text Search response body to candidates, skipping incomplete rows. */
export function parseGoogleTextSearch(body: unknown): Candidate[] {
  const places = (body as { places?: GooglePlace[] } | null)?.places;
  if (!Array.isArray(places)) return [];

  return places.flatMap((p): Candidate[] => {
    const lat = p.location?.latitude;
    const lng = p.location?.longitude;
    const name = p.displayName?.text;
    if (!p.id || !name || typeof lat !== "number" || typeof lng !== "number") {
      return [];
    }
    return [
      {
        provider: "google",
        providerPlaceId: p.id,
        name,
        formattedAddress: p.formattedAddress ?? "",
        lat,
        lng,
        primaryType: p.primaryType,
        category: categoryFromGoogleTypes(p.primaryType, p.types),
        mapsUri: p.googleMapsUri,
      },
    ];
  });
}

export class GooglePlacesProvider implements GeocodingProvider {
  readonly id = "google" as const;
  private readonly fetch: FetchLike;

  private readonly endpoint: string;

  constructor(
    private readonly opts: {
      apiKey: string;
      fetch?: FetchLike;
      /** Overrides the Text Search URL; E2E tests point it at a local mock. */
      endpoint?: string;
    },
  ) {
    if (!opts.apiKey) throw new Error("GOOGLE_MAPS_API_KEY is not set");
    this.fetch = opts.fetch ?? ((input, init) => fetch(input, init));
    this.endpoint = opts.endpoint || GOOGLE_TEXT_SEARCH_URL;
  }

  async search(q: SearchQuery): Promise<Candidate[]> {
    let res: Response;
    try {
      res = await this.fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": this.opts.apiKey,
          "X-Goog-FieldMask": GOOGLE_FIELD_MASK,
        },
        body: JSON.stringify(buildGoogleTextSearchBody(q)),
        signal: AbortSignal.timeout(5_000),
      });
    } catch (err) {
      throw new GeocodingError(
        `Google Places request failed: ${(err as Error).message}`,
        "google",
        true,
      );
    }

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new GeocodingError(
        `Google Places returned ${res.status}: ${detail.slice(0, 300)}`,
        "google",
        isRetryableStatus(res.status),
        res.status,
      );
    }
    return parseGoogleTextSearch(await res.json()).slice(
      0,
      clampLimit(q.limit),
    );
  }
}
