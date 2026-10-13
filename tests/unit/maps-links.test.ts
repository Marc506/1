import { describe, expect, it } from "vitest";
import {
  appleMapsDirectionsUrl,
  appleMapsOpenUrl,
  googleMapsDirectionsUrl,
  googleMapsOpenUrl,
  type LinkPlace,
} from "@/lib/maps-links";

const katz: LinkPlace = {
  name: "Katz's Delicatessen",
  lat: 40.7222319,
  lng: -73.9873866,
  formattedAddress: "205 E Houston St, New York, NY 10002, USA",
  provider: "google",
  providerPlaceId: "ChIJ-katz",
};

const manualPin: LinkPlace = {
  name: "小店 & Co",
  lat: 40.1 + 0.2, // 40.300000000000004
  lng: -74,
  provider: "manual",
};

describe("Apple Maps", () => {
  it("opens by name and coordinate", () => {
    expect(appleMapsOpenUrl(katz)).toBe(
      "https://maps.apple.com/?q=Katz's%20Delicatessen&ll=40.722232,-73.987387",
    );
  });

  it("encodes non-ASCII names and rounds float noise", () => {
    expect(appleMapsOpenUrl(manualPin)).toBe(
      "https://maps.apple.com/?q=%E5%B0%8F%E5%BA%97%20%26%20Co&ll=40.3,-74",
    );
  });

  it("navigates to name + address, walking by default", () => {
    expect(appleMapsDirectionsUrl(katz)).toBe(
      "https://maps.apple.com/?daddr=Katz's%20Delicatessen%2C%20205%20E%20Houston%20St%2C%20New%20York%2C%20NY%2010002%2C%20USA&dirflg=w",
    );
  });

  it("uses d / r for driving and transit", () => {
    expect(appleMapsDirectionsUrl(katz, "driving")).toMatch(/&dirflg=d$/);
    expect(appleMapsDirectionsUrl(katz, "transit")).toMatch(/&dirflg=r$/);
  });

  it("navigates to the coordinate when there is no address", () => {
    expect(appleMapsDirectionsUrl(manualPin)).toBe(
      "https://maps.apple.com/?daddr=40.3,-74&dirflg=w",
    );
    expect(appleMapsDirectionsUrl({ ...katz, formattedAddress: "" })).toBe(
      "https://maps.apple.com/?daddr=40.722232,-73.987387&dirflg=w",
    );
  });
});

describe("Google Maps", () => {
  it("opens with the Google place id", () => {
    expect(googleMapsOpenUrl(katz)).toBe(
      "https://www.google.com/maps/search/?api=1&query=40.722232,-73.987387&query_place_id=ChIJ-katz",
    );
  });

  it("omits the place id for non-Google places", () => {
    expect(googleMapsOpenUrl(manualPin)).toBe(
      "https://www.google.com/maps/search/?api=1&query=40.3,-74",
    );
    expect(
      googleMapsOpenUrl({
        ...katz,
        provider: "nominatim",
        providerPlaceId: "N1",
      }),
    ).not.toContain("query_place_id");
  });

  it("navigates with the place id and travel mode", () => {
    expect(googleMapsDirectionsUrl(katz)).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=40.722232,-73.987387&destination_place_id=ChIJ-katz&travelmode=walking",
    );
    expect(googleMapsDirectionsUrl(manualPin, "transit")).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=40.3,-74&travelmode=transit",
    );
  });
});
