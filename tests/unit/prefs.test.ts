import { describe, expect, it } from "vitest";
import { pickNavApp } from "@/lib/prefs/nav-app";

describe("pickNavApp", () => {
  it("defaults to Apple Maps", () => {
    expect(pickNavApp(undefined)).toBe("apple");
    expect(pickNavApp("waze")).toBe("apple");
    expect(pickNavApp("google")).toBe("google");
  });
});
