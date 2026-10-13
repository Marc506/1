const zhCN = {
  appName: "PlaceBook",
  tagline: "把在别处看到的好地方存下来，到了当地一键导航。",
  home: {
    emptyTitle: "还没有收藏",
    emptyBody: "收藏集合会显示在这里。",
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
    emptyBody: "Your collections will show up here.",
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
