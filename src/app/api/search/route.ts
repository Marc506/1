import { searchRequestSchema } from "@/lib/api/schemas";
import { getOwnerId } from "@/lib/auth/server";
import { createRateLimiter } from "@/lib/auth/rate-limit";
import { getDb } from "@/lib/db/client";
import {
  GeocodingError,
  getGeocoder,
  getPrimaryProviderId,
} from "@/lib/geocoding";
import { searchForCollection } from "@/lib/geocoding/search";

// Protects the Google bill from a runaway client; typing debounces to ~1/s.
const searchLimiter = createRateLimiter({ limit: 60, windowMs: 60_000 });

export async function POST(request: Request) {
  const ownerId = await getOwnerId();
  if (!ownerId)
    return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!searchLimiter.hit(ownerId)) {
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }

  const parsed = searchRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  try {
    const result = await searchForCollection(
      {
        db: getDb(),
        geocoder: getGeocoder(),
        primaryProvider: getPrimaryProviderId(),
      },
      ownerId,
      parsed.data,
    );
    if (!result.ok) {
      const status = result.error === "collection_not_found" ? 404 : 400;
      return Response.json({ error: result.error }, { status });
    }
    return Response.json(result);
  } catch (err) {
    console.error("[api/search]", err);
    const retryable = err instanceof GeocodingError && err.retryable;
    return Response.json(
      { error: retryable ? "provider_unavailable" : "provider_error" },
      { status: 502 },
    );
  }
}
