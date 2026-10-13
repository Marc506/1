"use client";

import type { Map as MapLibreMap, MapOptions } from "maplibre-gl";

/**
 * OpenFreeMap vector style: free, no key. Override with
 * NEXT_PUBLIC_MAP_STYLE_URL (E2E tests swap in a blank local style).
 */
export const MAP_STYLE_URL =
  process.env.NEXT_PUBLIC_MAP_STYLE_URL ??
  "https://tiles.openfreemap.org/styles/liberty";

let workerConfigured = false;

/** Lazily loads MapLibre (it is large) and creates a map, or returns null
 * when the browser cannot render one (no WebGL). */
export async function createMap(
  options: Omit<MapOptions, "style">,
): Promise<MapLibreMap | null> {
  const maplibre = await import("maplibre-gl");
  if (!workerConfigured) {
    // Copied there by scripts/copy-maplibre-worker.mjs.
    maplibre.setWorkerUrl(
      `/vendor/maplibre-gl-worker.mjs?v=${maplibre.getVersion()}`,
    );
    workerConfigured = true;
  }
  try {
    return new maplibre.Map({
      ...options,
      style: MAP_STYLE_URL,
      attributionControl: { compact: true },
    });
  } catch (err) {
    console.warn("[map] could not create map:", err);
    return null;
  }
}

export async function loadMapLibre() {
  return import("maplibre-gl");
}
