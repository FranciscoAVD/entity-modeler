import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    // "test" (not just "development"/"production") is a real value here — Bun's test runner sets
    // NODE_ENV=test automatically, and that path must keep permitting DB_FILE=:memory: too.
    NODE_ENV: z.enum(["development", "production"]).default("development"),
    // Path to the SQLite file; defaults to server/data/app.db when unset (see server/src/db/connection.ts).
    DB_FILE: z.string().optional(),
    PORT: z.coerce.number().default(3001),
  },
  runtimeEnv: process.env,
});

// The dev/test DBs are free to be :memory: (e.g. server/package.json's `test` script), but a real
// deployment must always persist to disk.
if (env.NODE_ENV === "production" && env.DB_FILE === ":memory:") {
  throw new Error(
    'DB_FILE must not be ":memory:" in production — the database must persist to disk.',
  );
}
