import { coord, sourceLines, whyLines, type ExportCollection } from "./types";

export const CSV_HEADER = [
  "Name",
  "Latitude",
  "Longitude",
  "Category",
  "Status",
  "Priority",
  "Note",
  "Why",
  "Sources",
] as const;

/** RFC 4180: quote fields containing a comma, quote or line break. */
export function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * CSV with a header row, as Google My Maps expects. My Maps picks
 * Latitude/Longitude as the location and Name as the title.
 */
export function toCsv(collection: ExportCollection): string {
  const rows = collection.places.map((p) => [
    p.name,
    coord(p.lat),
    coord(p.lng),
    p.category,
    p.status,
    String(p.priority),
    p.note?.trim() ?? "",
    whyLines(p).join(" / "),
    sourceLines(p).join(" / "),
  ]);
  return (
    [CSV_HEADER as readonly string[], ...rows]
      .map((row) => row.map(csvField).join(","))
      .join("\r\n") + "\r\n"
  );
}
