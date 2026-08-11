// Plain vector, not THREE.Vector3 — the data model stays independent of the renderer (plan.md decision #5).
export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Note {
  id: string;
  title: string;
  text: string;
  author?: string;
  createdAt: number;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
}

export interface Space {
  id: string;
  projectId: string;
  name: string;
  label?: string;
  origin: Vector3;
  tagIds: string[];
  notes: Note[];
  metadata?: Record<string, string | number>;
}

export interface Orbit {
  id: string;
  spaceId: string;
  name: string;
  label?: string;
  origin: Vector3;
  tagIds: string[];
  notes: Note[];
  metadata?: Record<string, string | number>;
}

export interface Node {
  id: string;
  spaceId: string;
  orbitId?: string;
  name: string;
  tagIds: string[];
  position: Vector3;
  notes: Note[];
  metadata?: Record<string, string | number>;
}

// Replaces the earlier ER-diagram-style "1:1"/"1:N"/"N:M" cardinality — sourceId/targetId already
// encode direction structurally, so the only genuinely independent piece of information is
// whether that direction is meaningful at all. See shared/src/schemas.ts's DirectionSchema for
// the full reasoning (mirrored here, kept a separately-declared type per decision #15).
export type Direction = "one-way" | "two-way";

export interface Relationship {
  id: string;
  sourceId: string;
  targetId: string;
  direction: Direction;
  tagIds: string[];
  notes: Note[];
  metadata?: Record<string, string | number>;
}

// The tag registry (plan.md decision #11) — space/orbit/node/relationship objects reference
// tags by id (tagIds) rather than duplicating free-typed strings, so renaming a tag only ever
// touches this one record, and every object that carries it picks up the new name. Tags are
// scoped to a project (projectId) — identity is (projectId, name), so "billing" in two
// different projects is two independent tags, never merged.
export interface Tag {
  id: string;
  projectId: string;
  name: string;
}

export type TabType = "node" | "relationship" | "orbit" | "space";

export interface Tab {
  id: string;
  type: TabType;
}

export type NoteTargetType = "space" | "orbit" | "node" | "relationship";

// Space/Orbit/Node share the same tags/metadata shape (Relationship also has tags/metadata,
// per plan.md decision #11, but isn't part of GroupDetails' shared rendering path since it has
// no name/label and its own bespoke InfoPanel layout).
export type GroupTargetType = "space" | "orbit" | "node";
