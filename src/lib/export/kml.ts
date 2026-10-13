import {
  coord,
  describePlace,
  type ExportCollection,
  type ExportLocale,
} from "./types";
import { escapeXml } from "./xml";

/**
 * KML for Google My Maps: Document > Folder (the collection) > Placemarks,
 * with category, status and priority as ExtendedData for styling by column.
 */
export function toKml(
  collection: ExportCollection,
  locale: ExportLocale = "zh-CN",
): string {
  const placemarks = collection.places.map((p) => {
    const description = describePlace(p, locale);
    const data = (
      [
        ["category", p.category],
        ["status", p.status],
        ["priority", String(p.priority)],
        ...(p.formattedAddress ? [["address", p.formattedAddress]] : []),
      ] as [string, string][]
    )
      .map(
        ([name, value]) =>
          `          <Data name="${name}"><value>${escapeXml(value)}</value></Data>`,
      )
      .join("\n");
    return [
      "      <Placemark>",
      `        <name>${escapeXml(p.name)}</name>`,
      ...(description
        ? [`        <description>${escapeXml(description)}</description>`]
        : []),
      "        <ExtendedData>",
      data,
      "        </ExtendedData>",
      `        <Point><coordinates>${coord(p.lng)},${coord(p.lat)},0</coordinates></Point>`,
      "      </Placemark>",
    ].join("\n");
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<kml xmlns="http://www.opengis.net/kml/2.2">',
    "  <Document>",
    `    <name>${escapeXml(collection.name)}</name>`,
    "    <Folder>",
    `      <name>${escapeXml(collection.name)}</name>`,
    ...placemarks,
    "    </Folder>",
    "  </Document>",
    "</kml>",
    "",
  ].join("\n");
}
