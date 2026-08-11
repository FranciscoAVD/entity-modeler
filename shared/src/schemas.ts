import { z } from "zod";

// Mirrors client/src/store/types.ts 1:1 — this package has zero DB dependency (only zod), so it
// can be imported by both `client` (browser bundle) and `server` (Drizzle) without ever pulling a
// driver into the client. Types are inferred from these schemas rather than hand-duplicated, so
// the two can't drift.

export const Vector3Schema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
});
export type Vector3 = z.infer<typeof Vector3Schema>;

const MetadataSchema = z.record(z.string(), z.union([z.string(), z.number()]));

export const NoteSchema = z.object({
  id: z.string(),
  title: z.string(),
  text: z.string(),
  author: z.string().optional(),
  createdAt: z.number(),
});
export type Note = z.infer<typeof NoteSchema>;

export const TagSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  name: z.string(),
});
export type Tag = z.infer<typeof TagSchema>;

export const ProjectSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
});
export type ProjectSummary = z.infer<typeof ProjectSummarySchema>;

export const SpaceSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  name: z.string(),
  label: z.string().optional(),
  origin: Vector3Schema,
  tagIds: z.array(z.string()),
  notes: z.array(NoteSchema),
  metadata: MetadataSchema.optional(),
});
export type Space = z.infer<typeof SpaceSchema>;

export const OrbitSchema = z.object({
  id: z.string(),
  spaceId: z.string(),
  name: z.string(),
  label: z.string().optional(),
  origin: Vector3Schema,
  tagIds: z.array(z.string()),
  notes: z.array(NoteSchema),
  metadata: MetadataSchema.optional(),
});
export type Orbit = z.infer<typeof OrbitSchema>;

export const NodeSchema = z.object({
  id: z.string(),
  spaceId: z.string(),
  orbitId: z.string().optional(),
  name: z.string(),
  tagIds: z.array(z.string()),
  position: Vector3Schema,
  notes: z.array(NoteSchema),
  metadata: MetadataSchema.optional(),
});
export type Node = z.infer<typeof NodeSchema>;

// Replaces the earlier ER-diagram-style "1:1"/"1:N"/"N:M" cardinality — that alluded to database
// schema multiplicity, a narrower assumption than this tool intends (see plan.md's own
// network-topology example). A relationship's sourceId/targetId already encode direction
// structurally; the only genuinely independent piece of information is whether that direction is
// meaningful at all. "one-way"/"two-way" is the whole stored vocabulary — the three-type framing
// a user sees ("Outgoing"/"Incoming"/"Bidirectional") is derived per-node from this plus whichever
// endpoint they're looking from, not separately stored.
export const DirectionSchema = z.enum(["one-way", "two-way"]);
export type Direction = z.infer<typeof DirectionSchema>;

export const RelationshipSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  targetId: z.string(),
  direction: DirectionSchema,
  tagIds: z.array(z.string()),
  notes: z.array(NoteSchema),
  metadata: MetadataSchema.optional(),
});
export type Relationship = z.infer<typeof RelationshipSchema>;

// Five flat sibling arrays, not a nested tree — matches how both sides actually store this data:
// the client's store is flat Map<id,T> per type with parent-pointer fields (Space.projectId,
// Orbit.spaceId, Node.spaceId/orbitId — plan.md decision #15), and the server's SQL schema is one
// table per type with the same FK columns. An earlier version of this schema nested
// spaces -> orbits -> nodes to read as a natural REST resource tree, but neither side stores it
// that way — every save had to build a tree the client doesn't have (serializeProject) and every
// load had to un-nest it again (loadProjectDetail's groupBy-and-rebuild), pure overhead in both
// directions for data that was already normalized on both ends. Used both as the
// GET /projects/:id response and the PUT /projects/:id request body (full-project upsert) — same
// shape both directions.
export const ProjectDetailSchema = z.object({
  project: ProjectSummarySchema,
  spaces: z.array(SpaceSchema),
  orbits: z.array(OrbitSchema),
  nodes: z.array(NodeSchema),
  relationships: z.array(RelationshipSchema),
  tags: z.array(TagSchema),
});
export type ProjectDetail = z.infer<typeof ProjectDetailSchema>;

export const ProjectListResponseSchema = z.array(ProjectSummarySchema);
