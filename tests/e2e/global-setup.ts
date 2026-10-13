import { resetDatabase } from "../support/db";
import { E2E_DATABASE_URL } from "./env";

/** Fresh E2E database for every run, built from the committed migrations. */
export default async function globalSetup() {
  await resetDatabase(E2E_DATABASE_URL);
}
