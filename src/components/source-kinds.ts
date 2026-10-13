import type { SourceKind } from "@/lib/db/schema";

/** Order shown in the source picker. */
export const SOURCE_KIND_OPTIONS: readonly SourceKind[] = [
  "xiaohongshu",
  "instagram",
  "tiktok",
  "youtube",
  "dianping",
  "wechat",
  "friend",
  "web",
  "other",
];
