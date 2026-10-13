import { whyLines, type ExportCollection, type ExportPlace } from "./types";

/**
 * One line per place: `name · first reason · link`. The caller supplies the
 * link (normally the Apple Maps URL) so this module stays free of other libs.
 */
export function toTextList(
  collection: ExportCollection,
  linkFor: (place: ExportPlace) => string,
): string {
  const lines = collection.places.map((p) => {
    const why = whyLines(p)[0]?.split(/\r?\n/)[0]?.trim();
    return [p.name, why, linkFor(p)].filter(Boolean).join(" · ");
  });
  return [collection.name, "", ...lines, ""].join("\n");
}
