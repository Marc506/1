"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { createMap, loadMapLibre } from "./maplibre";

export type MapPoint = {
  key: string;
  lat: number;
  lng: number;
  /** Shown inside the pin, e.g. "1". */
  label: string;
  /** Accessible name, e.g. "1. Katz's Delicatessen". */
  title: string;
  active: boolean;
};

/** Small map with numbered pins; tapping a pin selects it. */
export function CandidateMap({
  points,
  onSelect,
  className = "",
}: {
  points: MapPoint[];
  onSelect: (key: string) => void;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const onSelectRef = useRef(onSelect);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    let cancelled = false;
    void createMap({
      container: containerRef.current!,
      center: [0, 20],
      zoom: 1,
      cooperativeGestures: false,
    }).then((map) => {
      if (cancelled) return map?.remove();
      if (!map) return setFailed(true);
      mapRef.current = map;
      // Markers are DOM elements and do not need the style; show them even
      // if the tile server is slow or unreachable.
      setReady(true);
    });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  const pointsKey = JSON.stringify(points);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    let cancelled = false;
    void loadMapLibre().then(({ Marker, LngLatBounds }) => {
      if (cancelled) return;
      for (const m of markersRef.current) m.remove();
      markersRef.current = points.map((p) => {
        const el = document.createElement("button");
        el.type = "button";
        el.textContent = p.label;
        el.setAttribute("aria-label", p.title);
        el.dataset.testid = "map-pin";
        el.dataset.active = String(p.active);
        el.className = p.active
          ? "flex size-8 items-center justify-center rounded-full border-2 border-white bg-accent text-sm font-semibold text-white shadow-md"
          : "flex size-7 items-center justify-center rounded-full border-2 border-white bg-foreground/70 text-xs font-semibold text-background shadow";
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          onSelectRef.current(p.key);
        });
        return new Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(map);
      });
      if (points.length) {
        const bounds = new LngLatBounds();
        for (const p of points) bounds.extend([p.lng, p.lat]);
        map.fitBounds(bounds, { padding: 36, maxZoom: 15, duration: 0 });
      }
    });
    return () => {
      cancelled = true;
    };
    // pointsKey captures every field of `points`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointsKey, ready]);

  if (failed) return null;
  return (
    <div
      ref={containerRef}
      data-testid="candidate-map"
      className={`overflow-hidden rounded-2xl border border-border bg-surface ${className}`}
    />
  );
}
