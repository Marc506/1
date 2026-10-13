import "server-only";
import { cookies } from "next/headers";
import { NAV_APP_COOKIE, pickNavApp, type NavApp } from "./nav-app";

export async function getNavApp(): Promise<NavApp> {
  return pickNavApp((await cookies()).get(NAV_APP_COOKIE)?.value);
}
