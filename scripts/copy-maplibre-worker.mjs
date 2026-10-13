// MapLibre loads its Web Worker from a URL next to its own bundle, which
// does not survive bundling. Copy the worker into public/ so it can be served
// at a fixed path (see src/components/map/maplibre.ts). Runs on postinstall.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const pkgDir = path.dirname(require.resolve("maplibre-gl/package.json"));
const target = path.join("public", "vendor");
mkdirSync(target, { recursive: true });
copyFileSync(
  path.join(pkgDir, "dist", "maplibre-gl-worker.mjs"),
  path.join(target, "maplibre-gl-worker.mjs"),
);
