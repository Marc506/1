/**
 * Guard for the bilingual UI: visible text must come from
 * src/lib/i18n/dictionaries.ts, not be written into pages or components.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOTS = ["src/app", "src/components"];
// Universal strings that need no translation.
const ALLOWED_LITERALS = new Set(["https://", "🗽", "—", "✕", "＋", "▾", "📍"]);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(tsx?|mts)$/.test(name) ? [full] : [];
  });
}

const files = ROOTS.flatMap(sourceFiles).map((file) => ({
  file,
  // Comments may mention words; drop them before checking.
  code: readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/^\s*\/\/.*$/gm, ""),
}));

describe("no hard-coded UI copy", () => {
  it("has no Chinese text outside the dictionaries", () => {
    const hits = files.flatMap(({ file, code }) =>
      /[㐀-鿿]/.test(code) ? [file] : [],
    );
    expect(hits).toEqual([]);
  });

  it("has no English words as JSX text", () => {
    // `>Some words<` on one line, excluding generics like `=> Promise<`.
    const textNode =
      /(?<![=\-<])>\s*([A-Za-z][A-Za-z ,.'!?&]*[A-Za-z.!?])\s*</g;
    const hits = files.flatMap(({ file, code }) =>
      [...code.matchAll(textNode)]
        .map((m) => m[1])
        .filter((text) => !["Promise", "Record", "Partial"].includes(text))
        .map((text) => `${file}: ${text}`),
    );
    expect(hits).toEqual([]);
  });

  it("has no literal placeholder, aria-label, title or alt text", () => {
    const prop = /\b(placeholder|aria-label|title|alt)="([^"]+)"/g;
    const hits = files.flatMap(({ file, code }) =>
      [...code.matchAll(prop)]
        .filter((m) => !ALLOWED_LITERALS.has(m[2]))
        .map((m) => `${file}: ${m[1]}="${m[2]}"`),
    );
    expect(hits).toEqual([]);
  });
});
