import { describe, expect, it } from "vitest";
import {
  firstGrapheme,
  NAME_MAX,
  parseCollectionForm,
} from "@/lib/collections/form";

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

describe("parseCollectionForm", () => {
  it("trims and collapses whitespace; empty optional fields become null", () => {
    expect(
      parseCollectionForm(
        form({ name: "  纽约   2026 春假 ", emoji: " ", cityName: "" }),
      ),
    ).toEqual({
      ok: true,
      values: { name: "纽约 2026 春假", emoji: null, cityName: null },
    });
  });

  it("keeps the city and a single emoji", () => {
    expect(
      parseCollectionForm(
        form({ name: "Tokyo", emoji: "🗼🍣", cityName: " Tokyo " }),
      ),
    ).toEqual({
      ok: true,
      values: { name: "Tokyo", emoji: "🗼", cityName: "Tokyo" },
    });
  });

  it("requires a name", () => {
    const result = parseCollectionForm(form({ name: "   " }));
    expect(result).toMatchObject({ ok: false, errors: { name: "required" } });
  });

  it("limits name and city length", () => {
    const result = parseCollectionForm(
      form({ name: "x".repeat(NAME_MAX + 1), cityName: "c".repeat(121) }),
    );
    expect(result).toMatchObject({
      ok: false,
      errors: { name: "too_long", cityName: "too_long" },
    });
  });
});

describe("firstGrapheme", () => {
  it("keeps multi-code-point emoji intact", () => {
    expect(firstGrapheme("🇺🇸NYC")).toBe("🇺🇸");
    expect(firstGrapheme("👩‍👩‍👧x")).toBe("👩‍👩‍👧");
    expect(firstGrapheme("")).toBe("");
  });
});
