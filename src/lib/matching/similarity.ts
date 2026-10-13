import { normalizeName } from "./normalize";

/** Character bigrams of each word; single-character words count as one unit. */
function bigrams(text: string): string[] {
  return normalizeName(text)
    .split(" ")
    .filter(Boolean)
    .flatMap((word) => {
      const chars = [...word];
      if (chars.length === 1) return chars;
      return chars.slice(1).map((c, i) => chars[i] + c);
    });
}

function multiset(items: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const item of items) m.set(item, (m.get(item) ?? 0) + 1);
  return m;
}

function overlap(a: Map<string, number>, b: Map<string, number>): number {
  let n = 0;
  for (const [k, v] of a) n += Math.min(v, b.get(k) ?? 0);
  return n;
}

/**
 * 0..1 similarity between what the user typed and a place name. Works for
 * Latin and CJK text. Rewards either string containing the other, since
 * queries often add words ("纽约 Lilia 意面" for "Lilia") or drop them
 * ("Katz's" for "Katz's Delicatessen").
 */
export function nameSimilarity(query: string, name: string): number {
  const q = bigrams(query);
  const n = bigrams(name);
  if (!q.length || !n.length) return 0;
  const shared = overlap(multiset(q), multiset(n));
  const dice = (2 * shared) / (q.length + n.length);
  const containment = Math.max(shared / q.length, shared / n.length);
  return 0.7 * containment + 0.3 * dice;
}
