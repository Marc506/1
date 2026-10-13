/** What place-editing Server Functions return when they do not redirect. */
export type PlaceFormState = {
  error?: string;
  saved?: boolean;
  /** Changes on every successful save; used to reset forms. */
  savedAt?: number;
};
