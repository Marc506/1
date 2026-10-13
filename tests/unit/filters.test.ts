import { describe, expect, it } from "vitest";
import {
  DEFAULT_FILTERS,
  filtersQuery,
  hasActiveFilters,
  parsePlaceFilters,
} from "@/lib/collections/filters";

describe("parsePlaceFilters", () => {
  it("defaults when nothing is set", () => {
    expect(parsePlaceFilters({})).toEqual(DEFAULT_FILTERS);
  });

  it("reads known values", () => {
    expect(
      parsePlaceFilters({
        view: "map",
        cat: "cafe",
        status: "visited",
        tag: " late night ",
        sort: "priority",
      }),
    ).toEqual({
      view: "map",
      category: "cafe",
      status: "visited",
      tag: "late night",
      sort: "priority",
    });
  });

  it("ignores unknown values and takes the first of repeated keys", () => {
    expect(
      parsePlaceFilters({
        view: "globe",
        cat: "spaceport",
        status: ["visited", "skipped"],
        sort: "random",
        tag: "",
      }),
    ).toEqual({ ...DEFAULT_FILTERS, status: "visited" });
  });
});

describe("filtersQuery", () => {
  it("omits defaults", () => {
    expect(filtersQuery(DEFAULT_FILTERS)).toBe("");
  });

  it("applies a change on top of the current filters", () => {
    const current = parsePlaceFilters({ cat: "cafe", sort: "name" });
    expect(filtersQuery(current, { status: "visited" })).toBe(
      "?cat=cafe&status=visited&sort=name",
    );
    expect(filtersQuery(current, { category: null, view: "map" })).toBe(
      "?view=map&sort=name",
    );
  });

  it("encodes tags", () => {
    expect(filtersQuery(DEFAULT_FILTERS, { tag: "深夜 & 排队" })).toBe(
      "?tag=%E6%B7%B1%E5%A4%9C+%26+%E6%8E%92%E9%98%9F",
    );
  });
});

describe("hasActiveFilters", () => {
  it("ignores view and sort", () => {
    expect(
      hasActiveFilters({ ...DEFAULT_FILTERS, view: "map", sort: "name" }),
    ).toBe(false);
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, tag: "x" })).toBe(true);
  });
});
