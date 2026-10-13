import type { PlaceCategory } from "@/lib/db/schema";

/** Pin colors per category; visited places are drawn grey instead. */
export const CATEGORY_COLORS: Record<PlaceCategory, string> = {
  restaurant: "#e4572e",
  cafe: "#8d6346",
  bar: "#7b4fb8",
  dessert: "#e0559b",
  bakery: "#d99a2b",
  attraction: "#2a7de1",
  museum: "#3f51b5",
  park: "#2e9d57",
  viewpoint: "#14a3a3",
  shopping: "#c2408f",
  market: "#e07b1a",
  neighborhood: "#5b6b7a",
  hotel: "#4b6cb7",
  activity: "#d4a20b",
  other: "#6b7280",
};

export const VISITED_COLOR = "#a3a3a3";

export function pinColor(category: PlaceCategory, visited: boolean): string {
  return visited ? VISITED_COLOR : CATEGORY_COLORS[category];
}
