import { describe, expect, it } from "vitest";
import { passwordMatches } from "@/lib/auth/password";
import { createRateLimiter } from "@/lib/auth/rate-limit";
import {
  createSessionToken,
  safeNextPath,
  SESSION_TTL_SECONDS,
  verifySessionToken,
} from "@/lib/auth/session";

const SECRET = "x".repeat(32);

describe("session token", () => {
  it("round-trips the owner id", async () => {
    const token = await createSessionToken(SECRET);
    expect(await verifySessionToken(token, SECRET)).toBe("owner");
  });

  it("rejects a missing token or secret", async () => {
    const token = await createSessionToken(SECRET);
    expect(await verifySessionToken(undefined, SECRET)).toBeNull();
    expect(await verifySessionToken(token, undefined)).toBeNull();
  });

  it("rejects a token signed with another secret", async () => {
    const token = await createSessionToken("y".repeat(32));
    expect(await verifySessionToken(token, SECRET)).toBeNull();
  });

  it("rejects a tampered token", async () => {
    const token = await createSessionToken(SECRET);
    const [h, , s] = token.split(".");
    const forged = `${h}.${Buffer.from('{"sub":"admin"}').toString("base64url")}.${s}`;
    expect(await verifySessionToken(forged, SECRET)).toBeNull();
  });

  it("expires after the TTL", async () => {
    const issued = new Date("2026-01-01T00:00:00Z");
    const token = await createSessionToken(SECRET, "owner", issued);
    const before = new Date(
      issued.getTime() + (SESSION_TTL_SECONDS - 60) * 1000,
    );
    const after = new Date(
      issued.getTime() + (SESSION_TTL_SECONDS + 60) * 1000,
    );
    expect(await verifySessionToken(token, SECRET, before)).toBe("owner");
    expect(await verifySessionToken(token, SECRET, after)).toBeNull();
  });

  it("refuses a short secret", async () => {
    await expect(createSessionToken("short")).rejects.toThrow(/32/);
  });
});

describe("passwordMatches", () => {
  it("compares exactly", () => {
    expect(passwordMatches("hunter2", "hunter2")).toBe(true);
    expect(passwordMatches("hunter2 ", "hunter2")).toBe(false);
    expect(passwordMatches("", "hunter2")).toBe(false);
  });
});

describe("safeNextPath", () => {
  it.each([
    ["/c/123", "/c/123"],
    ["/c/123?view=map", "/c/123?view=map"],
    [undefined, "/"],
    ["", "/"],
    ["https://evil.example", "/"],
    ["//evil.example", "/"],
    ["/\\evil.example", "/"],
    ["/login", "/"],
    [["/a", "/b"], "/"],
  ])("%j -> %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });
});

describe("createRateLimiter", () => {
  it("allows `limit` hits per window per key", () => {
    const limiter = createRateLimiter({ limit: 5, windowMs: 60_000 });
    const t0 = 1_000_000;
    for (let i = 0; i < 5; i++) expect(limiter.hit("ip", t0 + i)).toBe(true);
    expect(limiter.hit("ip", t0 + 10)).toBe(false);
    expect(limiter.hit("other-ip", t0 + 10)).toBe(true);
    expect(limiter.hit("ip", t0 + 60_000)).toBe(true);
  });
});
