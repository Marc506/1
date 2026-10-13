import {
  coord,
  describePlace,
  type ExportCollection,
  type ExportLocale,
} from "./types";
import { escapeXml } from "./xml";

/** GPX 1.1 waypoints, one per place. */
export function toGpx(
  collection: ExportCollection,
  locale: ExportLocale = "zh-CN",
): string {
  const waypoints = collection.places.map((p) => {
    const description = describePlace(p, locale);
    return [
      `  <wpt lat="${coord(p.lat)}" lon="${coord(p.lng)}">`,
      `    <name>${escapeXml(p.name)}</name>`,
      ...(description ? [`    <desc>${escapeXml(description)}</desc>`] : []),
      `    <type>${escapeXml(p.category)}</type>`,
      "  </wpt>",
    ].join("\n");
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="PlaceBook" xmlns="http://www.topografix.com/GPX/1/1">',
    "  <metadata>",
    `    <name>${escapeXml(collection.name)}</name>`,
    "  </metadata>",
    ...waypoints,
    "</gpx>",
    "",
  ].join("\n");
}
