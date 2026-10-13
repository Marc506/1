import { categoryFromOsm } from "@/lib/matching/category-map";
import {
  clampLimit,
  GeocodingError,
  isRetryableStatus,
  type Candidate,
  type FetchLike,
  type GeocodingProvider,
  type SearchQuery,
} from "./provider";

export const NOMINATIM_SEARCH_URL =
  "https://nominatim.openstreetmap.org/search";
const DEFAULT_USER_AGENT =
  "PlaceBook/0.1 (+https://github.com/Marc506/placebook)";

type NominatimResult = {
  osm_type?: string;
  osm_id?: number;
  lat?: string;
  lon?: string;
  name?: string;
  display_name?: string;
  category?: string;
  type?: string;
};

/** Bounding box of a circle, as Nominatim's `viewbox` (lng1,lat1,lng2,lat2). */
export function viewboxFor(bias: NonNullable<SearchQuery["bias"]>): string {
  const dLat = bias.radiusM / 111_320;
  const dLng =
    bias.radiusM /
    (111_320 * Math.max(Math.cos((bias.lat * Math.PI) / 180), 0.01));
  const round = (n: number) => Number(n.toFixed(5));
  return [
    round(bias.lng - dLng),
    round(bias.lat + dLat),
    round(bias.lng + dLng),
    round(bias.lat - dLat),
  ].join(",");
}

export function buildNominatimUrl(q: SearchQuery): string {
  const params = new URLSearchParams({
    q: q.text,
    format: "jsonv2",
    limit: String(clampLimit(q.limit)),
    "accept-language": q.language,
  });
  if (q.region) params.set("countrycodes", q.region.toLowerCase());
  if (q.bias) {
    // Prefer results inside the box without excluding the rest.
    params.set("viewbox", viewboxFor(q.bias));
    params.set("bounded", "0");
  }
  return `${NOMINATIM_SEARCH_URL}?${params}`;
}

const OSM_TYPE_PREFIX: Record<string, string> = {
  node: "N",
  way: "W",
  relation: "R",
};

export function parseNominatim(body: unknown): Candidate[] {
  if (!Array.isArray(body)) return [];
  return (body as NominatimResult[]).flatMap((r): Candidate[] => {
    const lat = Number(r.lat);
    const lng = Number(r.lon);
    const prefix = r.osm_type ? OSM_TYPE_PREFIX[r.osm_type] : undefined;
    const name = r.name || r.display_name?.split(",")[0]?.trim();
    if (!prefix || r.osm_id === undefined || !name) return [];
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];
    const osmClass = r.category ?? "";
    const osmType = r.type ?? "";
    return [
      {
        provider: "nominatim",
        // OSM ids are stable; Nominatim's own place_id is not.
        providerPlaceId: `${prefix}${r.osm_id}`,
        name,
        formattedAddress: r.display_name ?? "",
        lat,
        lng,
        primaryType: `${osmClass}=${osmType}`,
        category: categoryFromOsm(osmClass, osmType),
      },
    ];
  });
}

/**
 * OpenStreetMap search. The public instance's usage policy asks for an
 * identifying User-Agent and at most one request per second, so calls from
 * one process are spaced out.
 */
export class NominatimProvider implements GeocodingProvider {
  readonly id = "nominatim" as const;
  private readonly fetch: FetchLike;
  private readonly minIntervalMs: number;
  private readonly userAgent: string;
  private nextSlot = 0;

  constructor(
    opts: {
      fetch?: FetchLike;
      minIntervalMs?: number;
      userAgent?: string;
    } = {},
  ) {
    this.fetch = opts.fetch ?? ((input, init) => fetch(input, init));
    this.minIntervalMs = opts.minIntervalMs ?? 1_000;
    this.userAgent = opts.userAgent || DEFAULT_USER_AGENT;
  }

  private async throttle(): Promise<void> {
    const now = Date.now();
    const wait = Math.max(0, this.nextSlot - now);
    this.nextSlot = Math.max(now, this.nextSlot) + this.minIntervalMs;
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  }

  async search(q: SearchQuery): Promise<Candidate[]> {
    await this.throttle();
    let res: Response;
    try {
      res = await this.fetch(buildNominatimUrl(q), {
        headers: { "User-Agent": this.userAgent, Accept: "application/json" },
        signal: AbortSignal.timeout(5_000),
      });
    } catch (err) {
      throw new GeocodingError(
        `Nominatim request failed: ${(err as Error).message}`,
        "nominatim",
        true,
      );
    }
    if (!res.ok) {
      throw new GeocodingError(
        `Nominatim returned ${res.status}`,
        "nominatim",
        isRetryableStatus(res.status),
        res.status,
      );
    }
    return parseNominatim(await res.json()).slice(0, clampLimit(q.limit));
  }
}
