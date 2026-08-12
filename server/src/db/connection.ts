import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { env } from "env/server";
import * as schema from "./schema";

// One real file per NODE_ENV (dev.db/prod.db/test.db, see env/server) — never :memory:.
export const DB_PATH = new URL(`../../data/${env.DB_FILE}`, import.meta.url).pathname;
const MIGRATIONS_FOLDER = new URL("../../drizzle", import.meta.url).pathname;

if (!existsSync(dirname(DB_PATH))) mkdirSync(dirname(DB_PATH), { recursive: true });

const sqlite = new Database(DB_PATH);
// SQLite doesn't enforce foreign keys by default — without this, the onDelete cascade/set-null
// rules declared in schema.ts would silently do nothing.
sqlite.run("PRAGMA foreign_keys = ON;");

export const db = drizzle(sqlite, { schema });

// Runs on every boot; a no-op once the schema is up to date (drizzle tracks applied migrations
// in its own `__drizzle_migrations` table). Keeps `bun run dev`/`start` a single command rather
// than requiring a separate manual migrate step for a single-user local tool.
migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
