import "server-only";
import { cookies, headers } from "next/headers";
import { dictionaries, type Dictionary } from "./dictionaries";
import { LOCALE_COOKIE, pickLocale, type Locale } from "./locale";

export async function getLocale(): Promise<Locale> {
  const [cookieStore, headerList] = await Promise.all([cookies(), headers()]);
  return pickLocale(
    cookieStore.get(LOCALE_COOKIE)?.value,
    headerList.get("accept-language"),
  );
}

export async function getDictionary(): Promise<Dictionary> {
  return dictionaries[await getLocale()];
}
