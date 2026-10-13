// Applies drizzle/ migrations during a Vercel build, before `next build`.
//
// - Production deployments (VERCEL_ENV=production): always.
// - Preview deployments: only with MIGRATE_ON_PREVIEW=1, e.g. when Neon gives
//   each preview its own database branch. Otherwise a preview could apply an
//   unmerged migration to the production database.
// - Anywhere else (local, CI): skipped; use `pnpm db:migrate`.
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const env = process.env.VERCEL_ENV;
const shouldRun =
  env === "production" ||
  (env === "preview" && process.env.MIGRATE_ON_PREVIEW === "1");

if (!shouldRun) {
  console.log(`[migrate] skipped (VERCEL_ENV=${env ?? "unset"})`);
  process.exit(0);
}

// Neon's pooled URL can't hold the session a migration needs; prefer direct.
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  console.error("[migrate] DATABASE_URL is not set; connect a database first.");
  process.exit(1);
}

const client = postgres(url, { max: 1, onnotice: () => {} });
try {
  await migrate(drizzle(client), { migrationsFolder: "drizzle" });
  console.log(`[migrate] migrations applied (${env})`);
} finally {
  await client.end();
}
