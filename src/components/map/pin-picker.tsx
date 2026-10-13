"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import type { Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { createMap } from "./maplibre";

export type LatLng = { lat: number; lng: number };

/**
 * Hand placement: the pin stays in the middle and the map moves under it,
 * which is easier on a phone than dragging a small marker.
 */
export function PinPicker({
  initial,
  zoom,
  onChange,
  unavailableText,
  className = "",
}: {
  initial: LatLng;
  zoom: number;
  onChange: (center: LatLng | null) => void;
  unavailableText: string;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const onChangeRef = useRef(onChange);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let cancelled = false;
    void createMap({
      container: containerRef.current!,
      center: [initial.lng, initial.lat],
      zoom,
    }).then((map) => {
      if (cancelled) return map?.remove();
      if (!map) {
        setFailed(true);
        onChangeRef.current(null);
        return;
      }
      mapRef.current = map;
      const report = () => {
        const c = map.getCenter();
        onChangeRef.current({ lat: c.lat, lng: c.lng });
      };
      map.on("load", report);
      // Report during the move too, so a save right after a drag (while
      // inertia is still settling) uses where the pin is now.
      map.on("move", report);
    });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // The map is created once; later changes to `initial` are ignored.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      className={`relative overflow-hidden rounded-2xl border border-border bg-surface ${className}`}
    >
      {/* Sized with h-full/w-full: MapLibre makes its container position: relative. */}
      <div
        ref={containerRef}
        data-testid="pin-picker-map"
        className="h-full w-full"
      />
      {/* The pin's tip sits exactly on the map center. */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full text-4xl leading-none drop-shadow"
      >
        📍
      </div>
    </div>
  );
}
