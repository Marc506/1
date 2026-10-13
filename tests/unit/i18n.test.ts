import { describe, expect, it } from "vitest";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { DEFAULT_LOCALE, pickLocale } from "@/lib/i18n/locale";

function leafPaths(value: unknown, prefix = ""): string[] {
  if (typeof value === "string") return [prefix];
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
    leafPaths(v, prefix ? `${prefix}.${k}` : k),
  );
}

describe("dictionaries", () => {
  it("zh-CN and en have the same keys and no empty strings", () => {
    const zh = leafPaths(dictionaries["zh-CN"]).sort();
    const en = leafPaths(dictionaries.en).sort();
    expect(en).toEqual(zh);
    for (const dict of Object.values(dictionaries)) {
      const json = JSON.stringify(dict);
      expect(json).not.toContain('""');
    }
  });
});

describe("pickLocale", () => {
  it("prefers a valid cookie", () => {
    expect(pickLocale("zh-CN", "en-US,en;q=0.9")).toBe("zh-CN");
    expect(pickLocale("en", "zh-CN")).toBe("en");
  });

  it("ignores an unknown cookie value", () => {
    expect(pickLocale("fr", "zh-Hans-CN")).toBe("zh-CN");
  });

  it("maps any Chinese variant to zh-CN", () => {
    expect(pickLocale(undefined, "zh-Hans-US,zh;q=0.9")).toBe("zh-CN");
    expect(pickLocale(undefined, "zh-TW")).toBe("zh-CN");
  });

  it("respects q-values and order", () => {
    expect(pickLocale(undefined, "en;q=0.5,zh-CN;q=0.8")).toBe("zh-CN");
    expect(pickLocale(undefined, "fr-FR,en-US;q=0.8,zh;q=0.7")).toBe("en");
    expect(pickLocale(undefined, "en-US,zh-CN")).toBe("en");
  });

  it("falls back to the default", () => {
    expect(pickLocale(undefined, undefined)).toBe(DEFAULT_LOCALE);
    expect(pickLocale(undefined, "fr-FR,de")).toBe(DEFAULT_LOCALE);
    expect(pickLocale(undefined, "zh;q=0")).toBe(DEFAULT_LOCALE);
  });
});
