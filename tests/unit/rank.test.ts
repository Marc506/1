import { describe, expect, it } from "vitest";
import type { Candidate } from "@/lib/geocoding/provider";
import { rankCandidates } from "@/lib/geocoding/rank";

function c(name: string, lat: number, lng: number): Candidate {
  return {
    provider: "google",
    providerPlaceId: name,
    name,
    formattedAddress: "",
    lat,
    lng,
    category: "other",
  };
}

const nyc = { lat: 40.7128, lng: -74.006, radiusM: 30_000 };

describe("rankCandidates", () => {
  it("keeps provider order when names and distances are alike", () => {
    const ranked = rankCandidates("Joe's Pizza", [
      c("Joe's Pizza", 40.73, -74.0),
      c("Joe's Pizza", 40.731, -74.001),
    ]);
    expect(ranked.map((r) => r.lat)).toEqual([40.73, 40.731]);
  });

  it("lifts a much better name match over provider order", () => {
    const ranked = rankCandidates("Lilia", [
      c("Lucali", 40.68, -74.0),
      c("Lilia", 40.7176, -73.9524),
    ]);
    expect(ranked[0].name).toBe("Lilia");
  });

  it("demotes a same-name place far from the bias center", () => {
    const ranked = rankCandidates(
      "Katz's Delicatessen",
      [
        c("Katz's Delicatessen", 34.05, -118.24), // Los Angeles
        c("Katz's Delicatessen", 40.7223, -73.9874), // NYC
      ],
      nyc,
    );
    expect(ranked[0].lat).toBe(40.7223);
    expect(ranked[0].distanceM).toBeLessThan(5_000);
    expect(ranked[1].distanceM).toBeGreaterThan(3_000_000);
  });

  it("adds no distance without a bias", () => {
    const [first] = rankCandidates("x", [c("x", 1, 1)]);
    expect(first.distanceM).toBeUndefined();
    expect(first.score).toBeGreaterThan(0);
  });
});
