export const NAME_MAX = 80;
export const CITY_MAX = 120;

export type CollectionFormValues = {
  name: string;
  emoji: string | null;
  cityName: string | null;
};

export type CollectionFormErrors = {
  name?: "required" | "too_long";
  cityName?: "too_long";
};

export type ParsedCollectionForm =
  | { ok: true; values: CollectionFormValues }
  | { ok: false; errors: CollectionFormErrors; values: CollectionFormValues };

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

/** Keeps only the first user-perceived character, e.g. a flag or ZWJ emoji. */
export function firstGrapheme(value: string): string {
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  const first = segmenter.segment(value)[Symbol.iterator]().next();
  return first.done ? "" : first.value.segment;
}

export function parseCollectionForm(formData: FormData): ParsedCollectionForm {
  const name = text(formData, "name");
  const emoji = firstGrapheme(text(formData, "emoji").replace(/\s/g, ""));
  const cityName = text(formData, "cityName");
  const values: CollectionFormValues = {
    name,
    emoji: emoji || null,
    cityName: cityName || null,
  };

  const errors: CollectionFormErrors = {};
  if (!name) errors.name = "required";
  else if ([...name].length > NAME_MAX) errors.name = "too_long";
  if ([...cityName].length > CITY_MAX) errors.cityName = "too_long";

  return Object.keys(errors).length
    ? { ok: false, errors, values }
    : { ok: true, values };
}

/** What a create/edit Server Function returns when it does not redirect. */
export type CollectionFormState = {
  errors?: CollectionFormErrors;
  values?: CollectionFormValues;
};
