# PlaceBook

A mobile-first web app for saving places you want to visit. Type a name, pick
the matching real place, and it is saved into a per-city collection. When you
are there, open it in Apple Maps or Google Maps in one tap, or export a
collection to Google My Maps.

界面支持中文与英文。设计文档见 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)，决策记录见
[`docs/DECISIONS.md`](docs/DECISIONS.md)。

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS · Drizzle ORM + PostgreSQL ·
MapLibre GL + OpenFreeMap · Vitest · Playwright

## Development

Requires Node 22 and pnpm 10.

```bash
pnpm install
cp .env.example .env.local   # then fill in values
pnpm dev
```

| Command                        | What it does                                           |
| ------------------------------ | ------------------------------------------------------ |
| `pnpm dev`                     | Next.js dev server                                     |
| `pnpm lint`                    | ESLint + Prettier check (`pnpm format` to fix)         |
| `pnpm typecheck`               | Generate route types and run `tsc --noEmit`            |
| `pnpm test`                    | Vitest unit tests                                      |
| `pnpm e2e`                     | Playwright: iPhone viewport + desktop Chromium         |
| `pnpm e2e:webkit`              | Only the iPhone WebKit project (needs WebKit)          |
| `pnpm shot <path> [--desktop]` | Screenshot a page in an iPhone viewport → `artifacts/` |

E2E tests build the app and start it on port 3100. When WebKit is not
installed they run the iPhone viewport on Chromium instead.
