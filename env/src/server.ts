import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

const base = createEnv({
  server: {
    // No default — NODE_ENV must be set explicitly (dev.db/prod.db/test.db below depend on it, and
    // guessing wrong here is exactly the kind of mistake this schema exists to prevent). "test" is
    // a real required value here too, not just "development"/"production" — Bun's test runner sets
    // NODE_ENV=test automatically.
    NODE_ENV: z.enum(["development", "production", "test"]),
    PORT: z.coerce.number().default(3001),
  },
  runtimeEnv: process.env,
});

// One SQLite file per environment, never :memory: — each environment's DB file is a fixed,
// derived name rather than a freely-settable path, so there's no way to point NODE_ENV=production
// at a non-persistent DB.
const DB_FILENAMES = {
  development: "dev.db",
  production: "prod.db",
  test: "test.db",
} as const;

export const env = {
  ...base,
  DB_FILE: DB_FILENAMES[base.NODE_ENV],
};
