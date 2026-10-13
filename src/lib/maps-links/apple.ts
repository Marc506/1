import { latLng, type LinkPlace, type TravelMode } from "./types";

const APPLE_DIRFLG: Record<TravelMode, string> = {
  walking: "w",
  driving: "d",
  transit: "r",
};

/**
 * Opens the place in Apple Maps (on iPhone, the app). Saving it to a Guide
 * is then one tap on "Save" in the place card; there is no API for that.
 */
export function appleMapsOpenUrl(place: LinkPlace): string {
  return `https://maps.apple.com/?q=${encodeURIComponent(place.name)}&ll=${latLng(place)}`;
}

export function appleMapsDirectionsUrl(
  place: LinkPlace,
  mode: TravelMode = "walking",
): string {
  const daddr = place.formattedAddress
    ? encodeURIComponent(`${place.name}, ${place.formattedAddress}`)
    : latLng(place);
  return `https://maps.apple.com/?daddr=${daddr}&dirflg=${APPLE_DIRFLG[mode]}`;
}
