import {
  GeocodingError,
  type Candidate,
  type GeocodingProvider,
  type ProviderId,
  type SearchQuery,
} from "./provider";

export type SearchResult = {
  candidates: Candidate[];
  provider: ProviderId;
  /** True when the primary provider failed and the fallback answered. */
  usedFallback: boolean;
};

export type Geocoder = { search(q: SearchQuery): Promise<SearchResult> };

/**
 * Tries the primary provider; on a retryable failure (429, 5xx, network) or
 * when the primary is unavailable (e.g. no API key), asks the fallback.
 * Other errors, such as a rejected API key, are not hidden.
 */
export function createGeocoder(opts: {
  primary: () => GeocodingProvider;
  fallback: GeocodingProvider;
  onFallback?: (reason: unknown) => void;
}): Geocoder {
  return {
    async search(q) {
      let primary: GeocodingProvider | undefined;
      try {
        primary = opts.primary();
      } catch (err) {
        opts.onFallback?.(err);
      }

      if (primary) {
        try {
          return {
            candidates: await primary.search(q),
            provider: primary.id,
            usedFallback: false,
          };
        } catch (err) {
          const retryable = err instanceof GeocodingError && err.retryable;
          if (!retryable || primary.id === opts.fallback.id) throw err;
          opts.onFallback?.(err);
        }
      }

      return {
        candidates: await opts.fallback.search(q),
        provider: opts.fallback.id,
        usedFallback: true,
      };
    },
  };
}
