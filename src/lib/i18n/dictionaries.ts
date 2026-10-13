const zhCN = {
  appName: "PlaceBook",
  tagline: "把在别处看到的好地方存下来，到了当地一键导航。",
  home: {
    emptyTitle: "还没有收藏",
    emptyBody: "收藏集合会显示在这里。",
  },
} as const;

type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };
export type Dictionary = Widen<typeof zhCN>;

const en: Dictionary = {
  appName: "PlaceBook",
  tagline:
    "Save great places you find anywhere, then navigate there in one tap.",
  home: {
    emptyTitle: "No collections yet",
    emptyBody: "Your collections will show up here.",
  },
};

export const dictionaries: Record<"zh-CN" | "en", Dictionary> = {
  "zh-CN": zhCN,
  en,
};
