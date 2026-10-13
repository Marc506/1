import type { TestProject } from "vitest/node";
import { resetDatabase } from "../../support/db";

const DEFAULT_URL = "postgres://postgres@localhost:54329/placebook_test";

declare module "vitest" {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

/** Recreate the test database schema from the committed migrations. */
export default async function setup(project: TestProject) {
  const url = process.env.TEST_DATABASE_URL ?? DEFAULT_URL;
  await resetDatabase(url);
  project.provide("databaseUrl", url);
}
