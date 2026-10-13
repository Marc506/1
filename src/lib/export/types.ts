import type { PlaceCategory, SourceKind, VisitStatus } from "@/lib/db/schema";

export type ExportMention = {
  why?: string | null;
  sourceKind?: SourceKind | null;
  sourceUrl?: string | null;
  sourceTitle?: string | null;
};

export type ExportPlace = {
  name: string;
  lat: number;
  lng: number;
  formattedAddress?: string | null;
  provider?: string | null;
  providerPlaceId?: string | null;
  category: PlaceCategory;
  status: VisitStatus;
  priority: number;
  note?: string | null;
  mentions?: ExportMention[];
};

export type ExportCollection = {
  name: string;
  places: ExportPlace[];
};

export type ExportLocale = "zh-CN" | "en";

/** 6 decimals is ~0.1 m; avoids float noise like 40.722231900000004. */
export function coord(n: number): string {
  return String(Number(n.toFixed(6)));
}

const LABELS: Record<
  ExportLocale,
  { why: string; sources: string; note: string }
> = {
  "zh-CN": { why: "理由", sources: "来源", note: "备注" },
  en: { why: "Why", sources: "Sources", note: "Note" },
};

export function whyLines(place: ExportPlace): string[] {
  return (place.mentions ?? [])
    .map((m) => m.why?.trim())
    .filter((w): w is string => !!w);
}

export function sourceLines(place: ExportPlace): string[] {
  return (place.mentions ?? []).flatMap((m) => {
    const url = m.sourceUrl?.trim();
    const title = m.sourceTitle?.trim();
    if (url && title) return [`${title} ${url}`];
    if (url || title) return [(url || title)!];
    return [];
  });
}

/** Plain-text description: reasons, then sources, then the personal note. */
export function describePlace(
  place: ExportPlace,
  locale: ExportLocale,
): string {
  const l = LABELS[locale];
  const parts: string[] = [];
  const why = whyLines(place);
  if (why.length) parts.push(`${l.why}: ${why.join(" / ")}`);
  const sources = sourceLines(place);
  if (sources.length) parts.push(`${l.sources}: ${sources.join(" / ")}`);
  if (place.note?.trim()) parts.push(`${l.note}: ${place.note.trim()}`);
  return parts.join("\n");
}
