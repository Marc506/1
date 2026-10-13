export const NAV_APPS = ["apple", "google"] as const;
export type NavApp = (typeof NAV_APPS)[number];
export const NAV_APP_COOKIE = "nav_app";
export const DEFAULT_NAV_APP: NavApp = "apple";

/** The person's default navigation app; Apple Maps unless they chose Google. */
export function pickNavApp(cookieValue: string | undefined): NavApp {
  return cookieValue === "google" ? "google" : DEFAULT_NAV_APP;
}
