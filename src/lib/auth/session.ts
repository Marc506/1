import { jwtVerify, SignJWT } from "jose";

export const SESSION_COOKIE = "pb_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 90;
/** Phase 1 is single-user; every row is owned by this id. */
export const OWNER_ID = "owner";

function key(secret: string): Uint8Array {
  if (secret.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters");
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(
  secret: string,
  ownerId: string = OWNER_ID,
  now: Date = new Date(),
): Promise<string> {
  const iat = Math.floor(now.getTime() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(ownerId)
    .setIssuedAt(iat)
    .setExpirationTime(iat + SESSION_TTL_SECONDS)
    .sign(key(secret));
}

/** Returns the owner id for a valid, unexpired token, otherwise null. */
export async function verifySessionToken(
  token: string | undefined,
  secret: string | undefined,
  now: Date = new Date(),
): Promise<string | null> {
  if (!token || !secret) return null;
  try {
    const { payload } = await jwtVerify(token, key(secret), {
      algorithms: ["HS256"],
      currentDate: now,
    });
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

/** Only allow same-origin absolute paths as a post-login destination. */
export function safeNextPath(next: unknown): string {
  if (typeof next !== "string" || !next.startsWith("/")) return "/";
  if (next.startsWith("//") || next.startsWith("/\\")) return "/";
  if (next === "/login" || next.startsWith("/login?")) return "/";
  return next;
}
