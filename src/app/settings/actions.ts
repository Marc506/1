"use server";

import { cookies } from "next/headers";
import { refresh } from "next/cache";
import { requireOwnerId } from "@/lib/auth/server";
import { LOCALE_COOKIE, LOCALES } from "@/lib/i18n/locale";
import { NAV_APP_COOKIE, NAV_APPS } from "@/lib/prefs/nav-app";

const ONE_YEAR = 60 * 60 * 24 * 365;

export async function setNavAppAction(app: string): Promise<void> {
  await requireOwnerId();
  if (!(NAV_APPS as readonly string[]).includes(app)) return;
  (await cookies()).set(NAV_APP_COOKIE, app, {
    path: "/",
    maxAge: ONE_YEAR,
    sameSite: "lax",
  });
  refresh();
}

/** "auto" follows the browser language. */
export async function setLanguageAction(lang: string): Promise<void> {
  await requireOwnerId();
  const store = await cookies();
  if (lang === "auto") store.delete(LOCALE_COOKIE);
  else if ((LOCALES as readonly string[]).includes(lang)) {
    store.set(LOCALE_COOKIE, lang, {
      path: "/",
      maxAge: ONE_YEAR,
      sameSite: "lax",
    });
  }
  refresh();
}
