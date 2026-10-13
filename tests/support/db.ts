import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

/** Creates the database if needed, then rebuilds it from drizzle/ migrations. */
export async function resetDatabase(url: string): Promise<void> {
  const target = new URL(url);
  const dbName = decodeURIComponent(target.pathname.slice(1));
  const admin = new URL(url);
  admin.pathname = "/postgres";

  const adminClient = postgres(admin.toString(), {
    max: 1,
    onnotice: () => {},
  });
  try {
    await adminClient`select 1`;
  } catch (err) {
    await adminClient.end();
    throw new Error(
      `Database server not reachable at ${admin.host}. Run \`pnpm db:start\` or set the database URL.`,
      { cause: err },
    );
  }
  const [exists] =
    await adminClient`select 1 from pg_database where datname = ${dbName}`;
  if (!exists) await adminClient.unsafe(`create database "${dbName}"`);
  await adminClient.end();

  const client = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await client.unsafe(
      "drop schema if exists drizzle cascade; drop schema public cascade; create schema public;",
    );
    await migrate(drizzle(client), { migrationsFolder: "drizzle" });
  } finally {
    await client.end();
  }
}
