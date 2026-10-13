// Settings for the servers Playwright starts. Test-only values.
export const E2E_PASSWORD = "e2e-password";
export const E2E_SESSION_SECRET = "e2e-session-secret-0123456789abcdef";

export const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ??
  "postgres://postgres@localhost:54329/placebook_e2e";

export const MOCK_GOOGLE_PORT = 3199;
export const MOCK_GOOGLE_KEY = "e2e-google-key";
