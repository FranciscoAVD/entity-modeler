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
  metadata: MetadataSchema.optional(),
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

export const CardinalitySchema = z.enum(["1:1", "1:N", "N:M"]);
export type Cardinality = z.infer<typeof CardinalitySchema>;

export const RelationshipSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  targetId: z.string(),
  cardinality: CardinalitySchema,
  tagIds: z.array(z.string()),
  notes: z.array(NoteSchema),
  metadata: MetadataSchema.optional(),
});
export type Relationship = z.infer<typeof RelationshipSchema>;

// The nested tree shape plan.md's Phase 9 design commits to: project -> spaces -> (orbits ->
// nodes) + ungroupedNodes, with relationships/tags as flat siblings (neither is owned by a single
// container — a relationship spans two nodes that may be in different spaces, and tags are a
// shared per-project registry). Used both as the GET /projects/:id response and the PUT
// /projects/:id request body (full-project upsert) — same shape both directions.
const OrbitDetailSchema = OrbitSchema.extend({
  nodes: z.array(NodeSchema),
});
export type OrbitDetail = z.infer<typeof OrbitDetailSchema>;

const SpaceDetailSchema = SpaceSchema.extend({
  orbits: z.array(OrbitDetailSchema),
  ungroupedNodes: z.array(NodeSchema),
});
export type SpaceDetail = z.infer<typeof SpaceDetailSchema>;

export const ProjectDetailSchema = z.object({
  project: ProjectSummarySchema,
  spaces: z.array(SpaceDetailSchema),
  relationships: z.array(RelationshipSchema),
  tags: z.array(TagSchema),
});
export type ProjectDetail = z.infer<typeof ProjectDetailSchema>;

export const ProjectListResponseSchema = z.array(ProjectSummarySchema);
