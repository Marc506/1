import { createHash, timingSafeEqual } from "node:crypto";

/** Constant-time comparison that does not leak the expected length. */
export function passwordMatches(input: string, expected: string): boolean {
  const a = createHash("sha256").update(input).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}
