import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySessionToken } from "./session";

/** The signed-in owner id, or null. Reads and verifies the session cookie. */
export async function getOwnerId(): Promise<string | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySessionToken(token, process.env.SESSION_SECRET);
}

/**
 * Use in every page, Server Function and Route Handler that touches owner
 * data. The proxy check is only an optimistic first line.
 */
export async function requireOwnerId(): Promise<string> {
  const ownerId = await getOwnerId();
  if (!ownerId) redirect("/login");
  return ownerId;
}
