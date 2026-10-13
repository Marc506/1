export const QUERY_MAX = 200;

/**
 * What we send to providers and use as the cache key: full-width characters
 * folded to half-width (NFKC), whitespace collapsed, trimmed, length capped.
 */
export function normalizeQuery(text: string): string {
  return [...text.normalize("NFKC").replace(/\s+/g, " ").trim()]
    .slice(0, QUERY_MAX)
    .join("");
}

/**
 * Loose form for comparing names: case, accents, apostrophes and other
 * punctuation removed. "Katz’s Delicatessen" and "katzs delicatessen" match.
 */
export function normalizeName(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/['’`]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
