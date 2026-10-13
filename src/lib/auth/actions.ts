"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { passwordMatches } from "./password";
import { createRateLimiter } from "./rate-limit";
import {
  createSessionToken,
  safeNextPath,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
} from "./session";

export type LoginState = {
  error?: "wrong_password" | "too_many_attempts" | "not_configured";
};

const loginLimiter = createRateLimiter({ limit: 5, windowMs: 60_000 });

async function clientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown"
  );
}

async function isHttps(): Promise<boolean> {
  return (await headers()).get("x-forwarded-proto") === "https";
}

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const expected = process.env.APP_PASSWORD;
  const secret = process.env.SESSION_SECRET;
  if (!expected || !secret || secret.length < 32) {
    return { error: "not_configured" };
  }
  if (!loginLimiter.hit(await clientIp())) {
    return { error: "too_many_attempts" };
  }

  const password = formData.get("password");
  if (typeof password !== "string" || !passwordMatches(password, expected)) {
    return { error: "wrong_password" };
  }

  (await cookies()).set(SESSION_COOKIE, await createSessionToken(secret), {
    httpOnly: true,
    secure: await isHttps(),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  redirect(safeNextPath(formData.get("next")));
}

export async function logout(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
