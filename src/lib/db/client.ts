import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;

export function createDb(url: string): { db: Db; close: () => Promise<void> } {
  // prepare: false keeps it compatible with Neon's pooled (PgBouncer) endpoint.
  const client = postgres(url, { prepare: false, max: 5 });
  return { db: drizzle(client, { schema }), close: () => client.end() };
}

const globalForDb = globalThis as unknown as { placebookDb?: Db };

/** Process-wide connection, reused across hot reloads in development. */
export function getDb(): Db {
  if (!globalForDb.placebookDb) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    globalForDb.placebookDb = createDb(url).db;
  }
  return globalForDb.placebookDb;
}
