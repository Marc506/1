import {
  PLACE_CATEGORIES,
  VISIT_STATUSES,
  type PlaceCategory,
  type VisitStatus,
} from "@/lib/db/schema";

export const PLACE_SORTS = ["recent", "priority", "name"] as const;
export type PlaceSort = (typeof PLACE_SORTS)[number];

export type PlaceFilters = {
  view: "list" | "map";
  category: PlaceCategory | null;
  status: VisitStatus | null;
  tag: string | null;
  sort: PlaceSort;
};

export const DEFAULT_FILTERS: PlaceFilters = {
  view: "list",
  category: null,
  status: null,
  tag: null,
  sort: "recent",
};

type Params = Record<string, string | string[] | undefined>;

function one(params: Params, key: string): string | undefined {
  const v = params[key];
  return Array.isArray(v) ? v[0] : v;
}

function oneOf<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
): T | null {
  return value !== undefined && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null;
}

/** Reads filters from the URL; unknown values fall back to defaults. */
export function parsePlaceFilters(params: Params): PlaceFilters {
  const tag = one(params, "tag")?.trim();
  return {
    view: one(params, "view") === "map" ? "map" : "list",
    category: oneOf(one(params, "cat"), PLACE_CATEGORIES),
    status: oneOf(one(params, "status"), VISIT_STATUSES),
    tag: tag ? tag.slice(0, 40) : null,
    sort: oneOf(one(params, "sort"), PLACE_SORTS) ?? "recent",
  };
}

/** Query string for `filters` with `change` applied; defaults are omitted. */
export function filtersQuery(
  filters: PlaceFilters,
  change: Partial<PlaceFilters> = {},
): string {
  const next = { ...filters, ...change };
  const params = new URLSearchParams();
  if (next.view !== "list") params.set("view", next.view);
  if (next.category) params.set("cat", next.category);
  if (next.status) params.set("status", next.status);
  if (next.tag) params.set("tag", next.tag);
  if (next.sort !== "recent") params.set("sort", next.sort);
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function hasActiveFilters(filters: PlaceFilters): boolean {
  return !!(filters.category || filters.status || filters.tag);
}
