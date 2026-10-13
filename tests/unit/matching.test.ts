import { describe, expect, it } from "vitest";
import { formatDistance, haversineMeters } from "@/lib/matching/geo";
import {
  normalizeName,
  normalizeQuery,
  QUERY_MAX,
} from "@/lib/matching/normalize";
import { nameSimilarity } from "@/lib/matching/similarity";

describe("normalizeQuery", () => {
  it("folds full-width characters and collapses whitespace", () => {
    expect(normalizeQuery("  Ｋａｔｚ’ｓ　　纽约   ")).toBe("Katz’s 纽约");
    expect(normalizeQuery("205\tE  Houston St\n")).toBe("205 E Houston St");
  });

  it("caps the length", () => {
    expect([...normalizeQuery("店".repeat(QUERY_MAX + 50))]).toHaveLength(
      QUERY_MAX,
    );
  });
});

describe("normalizeName", () => {
  it("drops case, accents, apostrophes and punctuation", () => {
    expect(normalizeName("Katz’s Delicatessen")).toBe("katzs delicatessen");
    expect(normalizeName("Café de Flore!")).toBe("cafe de flore");
    expect(normalizeName("Joe's Pizza — Carmine St.")).toBe(
      "joes pizza carmine st",
    );
    expect(normalizeName("蓝瓶咖啡（Blue Bottle）")).toBe(
      "蓝瓶咖啡 blue bottle",
    );
  });
});

describe("nameSimilarity", () => {
  it("is 1 for the same name in another form", () => {
    expect(
      nameSimilarity("katz's delicatessen", "Katz’s Delicatessen"),
    ).toBeCloseTo(1);
  });

  it("rewards a query contained in the name and vice versa", () => {
    expect(nameSimilarity("Katz's", "Katz's Delicatessen")).toBeGreaterThan(
      0.75,
    );
    expect(nameSimilarity("纽约 Lilia 意面", "Lilia")).toBeGreaterThan(0.75);
  });

  it("ranks the right place above an unrelated one", () => {
    expect(nameSimilarity("Lilia", "Lilia")).toBeGreaterThan(
      nameSimilarity("Lilia", "Lucali"),
    );
    expect(nameSimilarity("蓝瓶咖啡", "蓝瓶咖啡 三里屯")).toBeGreaterThan(
      nameSimilarity("蓝瓶咖啡", "星巴克"),
    );
  });

  it("is 0 when nothing is shared or input is empty", () => {
    expect(nameSimilarity("abc", "xyz")).toBe(0);
    expect(nameSimilarity("", "Lilia")).toBe(0);
  });
});

describe("geo", () => {
  it("measures distance on the sphere", () => {
    // Katz's to Times Square is about 3.6 km.
    const d = haversineMeters(
      { lat: 40.7223, lng: -73.9874 },
      { lat: 40.758, lng: -73.9855 },
    );
    expect(d).toBeGreaterThan(3_900);
    expect(d).toBeLessThan(4_000);
    expect(haversineMeters({ lat: 1, lng: 2 }, { lat: 1, lng: 2 })).toBe(0);
  });

  it("formats distances", () => {
    expect(formatDistance(3)).toBe("10 m");
    expect(formatDistance(347)).toBe("350 m");
    expect(formatDistance(1234)).toBe("1.2 km");
    expect(formatDistance(12_345)).toBe("12 km");
  });
});
