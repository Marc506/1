import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import type { TestProject } from "vitest/node";

const DEFAULT_URL = "postgres://postgres@localhost:54329/placebook_test";

declare module "vitest" {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

/** Recreate the test database schema from the committed migrations. */
export default async function setup(project: TestProject) {
  const url = process.env.TEST_DATABASE_URL ?? DEFAULT_URL;
  const client = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await client`select 1`;
  } catch (err) {
    await client.end();
    throw new Error(
      `Test database not reachable at ${url}. Run \`pnpm db:start\` or set TEST_DATABASE_URL.`,
      { cause: err },
    );
  }
  await client.unsafe(
    "drop schema if exists drizzle cascade; drop schema public cascade; create schema public;",
  );
  await migrate(drizzle(client), { migrationsFolder: "drizzle" });
  await client.end();
  project.provide("databaseUrl", url);
}
