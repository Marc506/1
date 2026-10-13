import { existsSync } from "node:fs";

// Live tests read real API keys from .env.local.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
