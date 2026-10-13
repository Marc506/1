/**
 * Stand-in for Places API (New) Text Search, so E2E runs never call Google.
 * Answers from tests/fixtures/google by the lowercased textQuery, and checks
 * the request shape the real API requires (key + field mask).
 */
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { GOOGLE_FIELD_MASK } from "../../src/lib/geocoding/google";
import { MOCK_GOOGLE_KEY, MOCK_GOOGLE_PORT } from "./env";

const fixtureDir = path.join(__dirname, "../fixtures/google");
const fixture = (name: string) =>
  JSON.parse(readFileSync(path.join(fixtureDir, name), "utf8"));

const RESPONSES: Record<string, unknown> = {
  "new york": fixture("text-search-city-new-york.json"),
  东京: fixture("text-search-city-tokyo-zh.json"),
  "katz's": fixture("text-search-katz.json"),
};

const server = createServer((req, res) => {
  const send = (status: number, body: unknown) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  };

  if (req.method === "GET" && req.url === "/health") return send(200, {});
  if (req.method !== "POST" || req.url !== "/v1/places:searchText") {
    return send(404, { error: "not found" });
  }
  if (req.headers["x-goog-api-key"] !== MOCK_GOOGLE_KEY) {
    return send(403, { error: { status: "PERMISSION_DENIED" } });
  }
  if (req.headers["x-goog-fieldmask"] !== GOOGLE_FIELD_MASK) {
    return send(400, { error: { status: "INVALID_ARGUMENT" } });
  }

  let raw = "";
  req.on("data", (chunk) => (raw += chunk));
  req.on("end", () => {
    const { textQuery } = JSON.parse(raw) as { textQuery?: string };
    send(200, RESPONSES[(textQuery ?? "").trim().toLowerCase()] ?? {});
  });
});

server.listen(MOCK_GOOGLE_PORT, () => {
  console.log(`mock Google Places on :${MOCK_GOOGLE_PORT}`);
});
