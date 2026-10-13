import { latLng, type LinkPlace, type TravelMode } from "./types";

function googlePlaceId(place: LinkPlace): string | undefined {
  return place.provider === "google" && place.providerPlaceId
    ? place.providerPlaceId
    : undefined;
}

export function googleMapsOpenUrl(place: LinkPlace): string {
  const id = googlePlaceId(place);
  return (
    `https://www.google.com/maps/search/?api=1&query=${latLng(place)}` +
    (id ? `&query_place_id=${encodeURIComponent(id)}` : "")
  );
}

export function googleMapsDirectionsUrl(
  place: LinkPlace,
  mode: TravelMode = "walking",
): string {
  const id = googlePlaceId(place);
  return (
    `https://www.google.com/maps/dir/?api=1&destination=${latLng(place)}` +
    (id ? `&destination_place_id=${encodeURIComponent(id)}` : "") +
    `&travelmode=${mode}`
  );
}
