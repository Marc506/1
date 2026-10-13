import { describe, expect, it } from "vitest";
import {
  checkMyMapsLimits,
  MY_MAPS_MAX_ROWS,
  toCsv,
  toGpx,
  toKml,
  toTextList,
  type ExportCollection,
  type ExportPlace,
} from "@/lib/export";
import { csvField } from "@/lib/export/csv";
import { escapeXml } from "@/lib/export/xml";

const katz: ExportPlace = {
  name: "Katz's Delicatessen",
  lat: 40.7222319,
  lng: -73.9873866,
  formattedAddress: "205 E Houston St, New York, NY 10002, USA",
  provider: "google",
  providerPlaceId: "ChIJ-katz",
  category: "restaurant",
  status: "want_to_go",
  priority: 2,
  note: "Cash only?",
  mentions: [
    {
      why: "Pastrami 三明治",
      sourceKind: "xiaohongshu",
      sourceUrl: "https://example.com/post/1",
      sourceTitle: "纽约必吃",
    },
    { why: "Open late", sourceKind: "friend" },
  ],
};

const bare: ExportPlace = {
  name: 'Tom & "Jerry" <Bar>',
  lat: 40.3,
  lng: -74,
  category: "bar",
  status: "visited",
  priority: 0,
};

const nyc: ExportCollection = { name: "纽约 2026 春假", places: [katz, bare] };

describe("toCsv", () => {
  it("writes the My Maps header and one row per place", () => {
    expect(toCsv(nyc)).toBe(
      [
        "Name,Latitude,Longitude,Category,Status,Priority,Note,Why,Sources",
        "Katz's Delicatessen,40.722232,-73.987387,restaurant,want_to_go,2,Cash only?,Pastrami 三明治 / Open late,纽约必吃 https://example.com/post/1",
        '"Tom & ""Jerry"" <Bar>",40.3,-74,bar,visited,0,,,',
        "",
      ].join("\r\n"),
    );
  });

  it("quotes commas, quotes and newlines", () => {
    expect(csvField("plain")).toBe("plain");
    expect(csvField("a,b")).toBe('"a,b"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField("line1\nline2")).toBe('"line1\nline2"');
  });
});

describe("toKml", () => {
  const kml = toKml(nyc, "zh-CN");

  it("nests placemarks in a folder named after the collection", () => {
    expect(kml).toMatch(
      /^<\?xml version="1.0" encoding="UTF-8"\?>\n<kml xmlns="http:\/\/www.opengis.net\/kml\/2.2">/,
    );
    expect(kml).toContain("<Folder>\n      <name>纽约 2026 春假</name>");
    expect(kml.match(/<Placemark>/g)).toHaveLength(2);
  });

  it("writes lng,lat order and extended data", () => {
    expect(kml).toContain("<coordinates>-73.987387,40.722232,0</coordinates>");
    expect(kml).toContain(
      '<Data name="category"><value>restaurant</value></Data>',
    );
    expect(kml).toContain('<Data name="priority"><value>2</value></Data>');
  });

  it("puts reasons, sources and note in the description", () => {
    expect(kml).toContain(
      "<description>理由: Pastrami 三明治 / Open late\n来源: 纽约必吃 https://example.com/post/1\n备注: Cash only?</description>",
    );
    expect(toKml(nyc, "en")).toContain("<description>Why: Pastrami");
  });

  it("escapes markup and omits empty descriptions", () => {
    expect(kml).toContain(
      "<name>Tom &amp; &quot;Jerry&quot; &lt;Bar&gt;</name>",
    );
    const barePlacemark = kml.split("<Placemark>")[2];
    expect(barePlacemark).not.toContain("<description>");
  });
});

describe("toGpx", () => {
  it("writes one waypoint per place", () => {
    const gpx = toGpx(nyc, "en");
    expect(gpx).toContain('<gpx version="1.1" creator="PlaceBook"');
    expect(gpx).toContain('<wpt lat="40.722232" lon="-73.987387">');
    expect(gpx).toContain("<type>restaurant</type>");
    expect(gpx).toContain(
      "<name>Tom &amp; &quot;Jerry&quot; &lt;Bar&gt;</name>",
    );
    expect(gpx.match(/<wpt /g)).toHaveLength(2);
  });
});

describe("toTextList", () => {
  it("lists name, first reason and the supplied link", () => {
    const text = toTextList(nyc, (p) => `https://maps.example/${p.lat}`);
    expect(text).toBe(
      [
        "纽约 2026 春假",
        "",
        "Katz's Delicatessen · Pastrami 三明治 · https://maps.example/40.7222319",
        'Tom & "Jerry" <Bar> · https://maps.example/40.3',
        "",
      ].join("\n"),
    );
  });
});

describe("escapeXml", () => {
  it("drops characters XML cannot hold", () => {
    expect(escapeXml("a\u0000b\u0008c\td\ne")).toBe("abc\td\ne");
  });
});

describe("checkMyMapsLimits", () => {
  it("passes a normal export", () => {
    expect(checkMyMapsLimits(toCsv(nyc), nyc.places.length)).toEqual([]);
  });

  it("flags too many rows and too many bytes", () => {
    expect(checkMyMapsLimits("x", MY_MAPS_MAX_ROWS + 1)).toEqual([
      { kind: "too_many_rows", rows: 2001, max: 2000 },
    ]);
    // 3 bytes per CJK character in UTF-8.
    const big = "店".repeat(2 * 1024 * 1024);
    expect(checkMyMapsLimits(big, 1)).toEqual([
      { kind: "too_large", bytes: 6 * 1024 * 1024, max: 5 * 1024 * 1024 },
    ]);
  });
});
