const zhCN = {
  appName: "PlaceBook",
  tagline: "把在别处看到的好地方存下来，到了当地一键导航。",
  home: {
    emptyTitle: "还没有收藏",
    emptyBody: "先建一个集合，比如「纽约 2026 春假」。",
    newCollection: "新建集合",
    archivedLink: "已归档（{count}）",
    archivedTitle: "已归档的集合",
    archivedEmpty: "没有已归档的集合。",
    backToCollections: "返回集合",
  },
  collection: {
    placeCountOne: "{count} 个地点",
    placeCountOther: "{count} 个地点",
    noPlacesTitle: "还没有地点",
    noPlacesBody: "这个集合里还没有地点。",
    edit: "编辑",
    back: "集合",
    cityNotFound:
      "没能定位「{city}」，添加地点时不会优先搜索这个城市附近。可以在编辑里换个写法，比如加上国家。",
    archivedBadge: "已归档",
  },
  collectionForm: {
    newTitle: "新建集合",
    editTitle: "编辑集合",
    nameLabel: "名称",
    namePlaceholder: "纽约 2026 春假",
    emojiLabel: "封面 emoji（可选）",
    cityLabel: "城市（可选）",
    cityPlaceholder: "New York",
    cityHelp: "填了城市，添加地点时会优先搜索这个城市附近。",
    create: "创建",
    save: "保存",
    saving: "正在保存…",
    cancel: "取消",
    archive: "归档这个集合",
    unarchive: "取消归档",
    archiveHelp: "归档后不会出现在首页，地点和数据都会保留。",
    errors: {
      name_required: "请填写名称。",
      name_too_long: "名称太长了（最多 80 个字）。",
      city_too_long: "城市名太长了（最多 120 个字）。",
    },
  },
  auth: {
    passwordLabel: "密码",
    submit: "进入",
    submitting: "正在验证…",
    logout: "退出登录",
    errors: {
      wrong_password: "密码不对，再试一次。",
      too_many_attempts: "尝试太频繁，请一分钟后再试。",
      not_configured: "服务器还没有配置 APP_PASSWORD 或 SESSION_SECRET。",
    },
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
    emptyBody: "Start with a collection, like “NYC spring break 2026”.",
    newCollection: "New collection",
    archivedLink: "Archived ({count})",
    archivedTitle: "Archived collections",
    archivedEmpty: "No archived collections.",
    backToCollections: "Back to collections",
  },
  collection: {
    placeCountOne: "{count} place",
    placeCountOther: "{count} places",
    noPlacesTitle: "No places yet",
    noPlacesBody: "This collection has no places yet.",
    edit: "Edit",
    back: "Collections",
    cityNotFound:
      "Couldn't locate “{city}”, so searches won't prefer places near it. Try another spelling in Edit, e.g. add the country.",
    archivedBadge: "Archived",
  },
  collectionForm: {
    newTitle: "New collection",
    editTitle: "Edit collection",
    nameLabel: "Name",
    namePlaceholder: "NYC spring break 2026",
    emojiLabel: "Cover emoji (optional)",
    cityLabel: "City (optional)",
    cityPlaceholder: "New York",
    cityHelp: "With a city, searches prefer places near it.",
    create: "Create",
    save: "Save",
    saving: "Saving…",
    cancel: "Cancel",
    archive: "Archive this collection",
    unarchive: "Unarchive",
    archiveHelp:
      "Archived collections are hidden from the home page. Nothing is deleted.",
    errors: {
      name_required: "Enter a name.",
      name_too_long: "That name is too long (80 characters max).",
      city_too_long: "That city name is too long (120 characters max).",
    },
  },
  auth: {
    passwordLabel: "Password",
    submit: "Enter",
    submitting: "Checking…",
    logout: "Sign out",
    errors: {
      wrong_password: "Wrong password. Try again.",
      too_many_attempts: "Too many attempts. Wait a minute and try again.",
      not_configured: "The server is missing APP_PASSWORD or SESSION_SECRET.",
    },
  },
};

export const dictionaries: Record<"zh-CN" | "en", Dictionary> = {
  "zh-CN": zhCN,
  en,
};
