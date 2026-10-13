export type LinkPlace = {
  name: string;
  lat: number;
  lng: number;
  formattedAddress?: string | null;
  provider?: string | null;
  providerPlaceId?: string | null;
};

export type TravelMode = "walking" | "driving" | "transit";

/** 6 decimals is ~0.1 m; avoids float noise like 40.722231900000004. */
export function coord(n: number): string {
  return String(Number(n.toFixed(6)));
}

export function latLng(place: LinkPlace): string {
  return `${coord(place.lat)},${coord(place.lng)}`;
}
