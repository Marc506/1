/** Google My Maps import limits for one layer. */
export const MY_MAPS_MAX_ROWS = 2000;
export const MY_MAPS_MAX_BYTES = 5 * 1024 * 1024;

export type LimitIssue =
  | { kind: "too_many_rows"; rows: number; max: number }
  | { kind: "too_large"; bytes: number; max: number };

/** Problems that would make a My Maps import fail; empty when it fits. */
export function checkMyMapsLimits(content: string, rows: number): LimitIssue[] {
  const issues: LimitIssue[] = [];
  if (rows > MY_MAPS_MAX_ROWS) {
    issues.push({ kind: "too_many_rows", rows, max: MY_MAPS_MAX_ROWS });
  }
  const bytes = new TextEncoder().encode(content).length;
  if (bytes > MY_MAPS_MAX_BYTES) {
    issues.push({ kind: "too_large", bytes, max: MY_MAPS_MAX_BYTES });
  }
  return issues;
}
