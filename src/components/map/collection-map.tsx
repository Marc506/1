"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import type { GeoJSONSource, Map as MapLibreMap, Marker } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import type { PlaceCategory, VisitStatus } from "@/lib/db/schema";
import { pinColor } from "./category-colors";
import { createMap, loadMapLibre } from "./maplibre";

export type CollectionMapPlace = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: PlaceCategory;
  status: VisitStatus;
  /** Shown under the name in the popup, e.g. "Restaurant · 205 E Houston St". */
  subtitle: string;
  /** Detail page; the popup title links there. */
  href: string;
};

/** Above this many places, pins are clustered on the GPU instead of drawn as
 * individual DOM markers. */
export const CLUSTER_THRESHOLD = 100;

export function CollectionMap({
  places,
  unavailableText,
  className = "",
}: {
  places: CollectionMapPlace[];
  unavailableText: string;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const clustered = places.length >= CLUSTER_THRESHOLD;
  const placesKey = JSON.stringify(places);

  useEffect(() => {
    let cancelled = false;
    let map: MapLibreMap | null = null;
    const markers: Marker[] = [];

    void (async () => {
      map = await createMap({
        container: containerRef.current!,
        center: [0, 20],
        zoom: 1,
      });
      if (cancelled) return map?.remove();
      if (!map) return setFailed(true);
      const m = map;
      const { Marker, Popup, LngLatBounds } = await loadMapLibre();
      if (cancelled) return;

      const popupFor = (p: CollectionMapPlace) => {
        const root = document.createElement("div");
        root.className = "min-w-40 text-sm";
        const title = document.createElement("a");
        title.href = p.href;
        title.className = "block font-medium text-[#0a7c5a] underline";
        title.textContent = p.name;
        const sub = document.createElement("div");
        sub.className = "text-[#6b6b70]";
        sub.textContent = p.subtitle;
        root.append(title, sub);
        return new Popup({
          offset: 12,
          closeButton: false,
          maxWidth: "260px",
        }).setDOMContent(root);
      };

      if (places.length) {
        const bounds = new LngLatBounds();
        for (const p of places) bounds.extend([p.lng, p.lat]);
        m.fitBounds(bounds, { padding: 48, maxZoom: 15, duration: 0 });
      }

      if (!clustered) {
        for (const p of places) {
          const el = document.createElement("button");
          el.type = "button";
          el.dataset.testid = "place-pin";
          el.dataset.status = p.status;
          el.setAttribute("aria-label", p.name);
          el.className =
            "block size-4 rounded-full border-2 border-white shadow-[0_1px_3px_rgba(0,0,0,0.4)]";
          el.style.backgroundColor = pinColor(
            p.category,
            p.status === "visited",
          );
          markers.push(
            new Marker({ element: el })
              .setLngLat([p.lng, p.lat])
              .setPopup(popupFor(p))
              .addTo(m),
          );
        }
        return;
      }

      // Many places: one GeoJSON source with clustering.
      const byId = new Map(places.map((p) => [p.id, p]));
      const addLayers = () => {
        m.addSource("places", {
          type: "geojson",
          cluster: true,
          clusterRadius: 40,
          data: {
            type: "FeatureCollection",
            features: places.map((p) => ({
              type: "Feature",
              geometry: { type: "Point", coordinates: [p.lng, p.lat] },
              properties: {
                id: p.id,
                color: pinColor(p.category, p.status === "visited"),
              },
            })),
          },
        });
        m.addLayer({
          id: "clusters",
          type: "circle",
          source: "places",
          filter: ["has", "point_count"],
          paint: {
            "circle-color": "#0a7c5a",
            "circle-opacity": 0.85,
            "circle-radius": [
              "step",
              ["get", "point_count"],
              14,
              20,
              18,
              50,
              24,
            ],
            "circle-stroke-color": "#fff",
            "circle-stroke-width": 2,
          },
        });
        m.addLayer({
          id: "points",
          type: "circle",
          source: "places",
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-color": ["get", "color"],
            "circle-radius": 7,
            "circle-stroke-color": "#fff",
            "circle-stroke-width": 2,
          },
        });
        m.on("click", "clusters", async (e) => {
          const feature = e.features?.[0];
          if (!feature) return;
          const source = m.getSource("places") as GeoJSONSource;
          const zoom = await source.getClusterExpansionZoom(
            feature.properties.cluster_id,
          );
          m.easeTo({
            center: (feature.geometry as { coordinates: [number, number] })
              .coordinates,
            zoom,
          });
        });
        m.on("click", "points", (e) => {
          const feature = e.features?.[0];
          const place = feature && byId.get(feature.properties.id);
          if (place) popupFor(place).setLngLat([place.lng, place.lat]).addTo(m);
        });
      };
      if (m.isStyleLoaded()) addLayers();
      else m.once("load", addLayers);
    })();

    return () => {
      cancelled = true;
      for (const marker of markers) marker.remove();
      map?.remove();
    };
    // placesKey captures every field of `places`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placesKey, clustered]);

  if (failed) {
    return (
      <p
        role="alert"
        className="rounded-2xl border border-border bg-surface px-4 py-6 text-center text-sm text-muted"
      >
        {unavailableText}
      </p>
    );
  }

  return (
    <div
      ref={containerRef}
      data-testid="collection-map"
      data-mode={clustered ? "clustered" : "markers"}
      className={`overflow-hidden rounded-2xl border border-border bg-surface ${className}`}
    />
  );
}
