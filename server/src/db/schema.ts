import { primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

// One table per domain type, matching client/src/store/types.ts (mirrored via `shared`'s Zod
// schemas). Vector3 fields flatten to _x/_y/_z columns; metadata stays a JSON column since it's
// explicitly freeform. Foreign keys use onDelete cascade/set-null as a referential-integrity
// safety net only — the actual cascade *business logic* (what gets deleted vs. reassigned) lives
// entirely in the client's store.ts, already tested; the server just persists whatever complete,
// already-valid project the client sends on each full-project upsert.

type Metadata = Record<string, string | number>;

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
});

export const spaces = sqliteTable("spaces", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  label: text("label"),
  originX: real("origin_x").notNull(),
  originY: real("origin_y").notNull(),
  originZ: real("origin_z").notNull(),
  metadata: text("metadata", { mode: "json" }).$type<Metadata>(),
});

export const orbits = sqliteTable("orbits", {
  id: text("id").primaryKey(),
  spaceId: text("space_id")
    .notNull()
    .references(() => spaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  label: text("label"),
  originX: real("origin_x").notNull(),
  originY: real("origin_y").notNull(),
  originZ: real("origin_z").notNull(),
  metadata: text("metadata", { mode: "json" }).$type<Metadata>(),
});

// orbitId uses "set null" (not cascade) — deleting an orbit reassigns its nodes to orbit-less
// rather than deleting them, matching store.ts's deleteOrbit. spaceId is the required parent
// (decision #10), so it cascades.
export const nodes = sqliteTable("nodes", {
  id: text("id").primaryKey(),
  spaceId: text("space_id")
    .notNull()
    .references(() => spaces.id, { onDelete: "cascade" }),
  orbitId: text("orbit_id").references(() => orbits.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  positionX: real("position_x").notNull(),
  positionY: real("position_y").notNull(),
  positionZ: real("position_z").notNull(),
  metadata: text("metadata", { mode: "json" }).$type<Metadata>(),
});

export const relationships = sqliteTable("relationships", {
  id: text("id").primaryKey(),
  sourceId: text("source_id")
    .notNull()
    .references(() => nodes.id, { onDelete: "cascade" }),
  targetId: text("target_id")
    .notNull()
    .references(() => nodes.id, { onDelete: "cascade" }),
  cardinality: text("cardinality", { enum: ["1:1", "1:N", "N:M"] }).notNull(),
  metadata: text("metadata", { mode: "json" }).$type<Metadata>(),
});

export const tags = sqliteTable("tags", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
});

// One table, not four — matches decision #6's "same shape, same rendering path at every level" —
// but with a real FK per possible parent (exactly one of the four is set per row, enforced by
// writes.ts, not a DB CHECK) instead of a polymorphic targetType/targetId pair. This gives every
// note proper referential integrity and cascade-on-delete without needing a separate table per
// type. No `metadata` column — metadata is exclusively an object-level concept (decision #11),
// never per-note.
export const notes = sqliteTable("notes", {
  id: text("id").primaryKey(),
  spaceId: text("space_id").references(() => spaces.id, { onDelete: "cascade" }),
  orbitId: text("orbit_id").references(() => orbits.id, { onDelete: "cascade" }),
  nodeId: text("node_id").references(() => nodes.id, { onDelete: "cascade" }),
  relationshipId: text("relationship_id").references(() => relationships.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  text: text("text").notNull(),
  author: text("author"),
  createdAt: real("created_at").notNull(),
});

// Four join tables for the tagIds many-to-many (a plain array column isn't representable in SQL
// the way it is in the client's normalized store) — composite primary key, no surrogate id needed.
export const spaceTags = sqliteTable(
  "space_tags",
  {
    spaceId: text("space_id")
      .notNull()
      .references(() => spaces.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.spaceId, t.tagId] })],
);

export const orbitTags = sqliteTable(
  "orbit_tags",
  {
    orbitId: text("orbit_id")
      .notNull()
      .references(() => orbits.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.orbitId, t.tagId] })],
);

export const nodeTags = sqliteTable(
  "node_tags",
  {
    nodeId: text("node_id")
      .notNull()
      .references(() => nodes.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.nodeId, t.tagId] })],
);

export const relationshipTags = sqliteTable(
  "relationship_tags",
  {
    relationshipId: text("relationship_id")
      .notNull()
      .references(() => relationships.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.relationshipId, t.tagId] })],
);
