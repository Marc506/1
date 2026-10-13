import type { PlaceCategory } from "@/lib/db/schema";

/** Google Places (New) place types that map directly to a category. */
const GOOGLE_EXACT: Record<string, PlaceCategory> = {
  // Checked before the "_restaurant" suffix rule.
  dessert_restaurant: "dessert",
  dessert_shop: "dessert",
  ice_cream_shop: "dessert",
  confectionery: "dessert",
  chocolate_shop: "dessert",
  candy_store: "dessert",
  donut_shop: "dessert",
  juice_shop: "cafe",
  bakery: "bakery",
  restaurant: "restaurant",
  food_court: "restaurant",
  meal_takeaway: "restaurant",
  deli: "restaurant",
  cafe: "cafe",
  coffee_shop: "cafe",
  tea_house: "cafe",
  cat_cafe: "cafe",
  dog_cafe: "cafe",
  bar: "bar",
  pub: "bar",
  wine_bar: "bar",
  cocktail_bar: "bar",
  bar_and_grill: "bar",
  night_club: "bar",
  brewery: "bar",
  museum: "museum",
  art_gallery: "museum",
  history_museum: "museum",
  art_museum: "museum",
  park: "park",
  national_park: "park",
  state_park: "park",
  city_park: "park",
  garden: "park",
  botanical_garden: "park",
  dog_park: "park",
  beach: "park",
  observation_deck: "viewpoint",
  scenic_spot: "viewpoint",
  tourist_attraction: "attraction",
  historical_landmark: "attraction",
  historical_place: "attraction",
  monument: "attraction",
  cultural_landmark: "attraction",
  sculpture: "attraction",
  amusement_park: "attraction",
  aquarium: "attraction",
  zoo: "attraction",
  plaza: "attraction",
  bridge: "attraction",
  market: "market",
  farmers_market: "market",
  flea_market: "market",
  neighborhood: "neighborhood",
  sublocality: "neighborhood",
  sublocality_level_1: "neighborhood",
  lodging: "hotel",
  hotel: "hotel",
  motel: "hotel",
  hostel: "hotel",
  inn: "hotel",
  resort_hotel: "hotel",
  bed_and_breakfast: "hotel",
  guest_house: "hotel",
  shopping_mall: "shopping",
  department_store: "shopping",
  book_store: "shopping",
  clothing_store: "shopping",
  gift_shop: "shopping",
  store: "shopping",
  movie_theater: "activity",
  performing_arts_theater: "activity",
  concert_hall: "activity",
  bowling_alley: "activity",
  karaoke: "activity",
  spa: "activity",
  amusement_center: "activity",
  water_park: "activity",
  hiking_area: "activity",
  ski_resort: "activity",
};

function googleType(type: string): PlaceCategory | undefined {
  const exact = GOOGLE_EXACT[type];
  if (exact) return exact;
  if (type.endsWith("_restaurant")) return "restaurant";
  if (type.endsWith("_store") || type.endsWith("_shop")) return "shopping";
  return undefined;
}

/** primaryType wins; otherwise the first of `types` that maps. */
export function categoryFromGoogleTypes(
  primaryType: string | undefined,
  types: readonly string[] = [],
): PlaceCategory {
  for (const type of primaryType ? [primaryType, ...types] : types) {
    const category = googleType(type);
    if (category) return category;
  }
  return "other";
}

/** OpenStreetMap `class=type` pairs, as returned by Nominatim. */
const OSM_EXACT: Record<string, PlaceCategory> = {
  "amenity=restaurant": "restaurant",
  "amenity=fast_food": "restaurant",
  "amenity=food_court": "restaurant",
  "amenity=cafe": "cafe",
  "amenity=bar": "bar",
  "amenity=pub": "bar",
  "amenity=biergarten": "bar",
  "amenity=nightclub": "bar",
  "amenity=ice_cream": "dessert",
  "shop=confectionery": "dessert",
  "shop=pastry": "dessert",
  "shop=chocolate": "dessert",
  "shop=bakery": "bakery",
  "amenity=marketplace": "market",
  "amenity=theatre": "activity",
  "amenity=cinema": "activity",
  "tourism=museum": "museum",
  "tourism=gallery": "museum",
  "tourism=viewpoint": "viewpoint",
  "tourism=attraction": "attraction",
  "tourism=artwork": "attraction",
  "tourism=theme_park": "attraction",
  "tourism=zoo": "attraction",
  "tourism=aquarium": "attraction",
  "historic=monument": "attraction",
  "historic=memorial": "attraction",
  "leisure=park": "park",
  "leisure=garden": "park",
  "leisure=nature_reserve": "park",
  "natural=beach": "park",
  "tourism=hotel": "hotel",
  "tourism=motel": "hotel",
  "tourism=hostel": "hotel",
  "tourism=guest_house": "hotel",
  "place=neighbourhood": "neighborhood",
  "place=quarter": "neighborhood",
  "place=suburb": "neighborhood",
};

export function categoryFromOsm(
  osmClass: string,
  osmType: string,
): PlaceCategory {
  const exact = OSM_EXACT[`${osmClass}=${osmType}`];
  if (exact) return exact;
  if (osmClass === "shop") return "shopping";
  if (osmClass === "leisure") return "activity";
  if (osmClass === "historic") return "attraction";
  return "other";
}
