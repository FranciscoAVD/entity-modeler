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
  metadata?: Record<string, string | number>;
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
  tags: string[];
  notes: Note[];
  metadata?: Record<string, string | number>;
}

export interface Orbit {
  id: string;
  spaceId: string;
  name: string;
  label?: string;
  origin: Vector3;
  tags: string[];
  notes: Note[];
  metadata?: Record<string, string | number>;
}

export interface Entity {
  id: string;
  spaceId: string;
  orbitId?: string;
  name: string;
  tags: string[];
  position: Vector3;
  notes: Note[];
  metadata?: Record<string, string | number>;
}

export type Cardinality = "1:1" | "1:N" | "N:M";

export interface Relationship {
  id: string;
  sourceId: string;
  targetId: string;
  cardinality: Cardinality;
  notes: Note[];
}

export type TabType = "entity" | "relationship" | "orbit" | "space";

export interface Tab {
  id: string;
  type: TabType;
}

export type NoteTargetType = "space" | "orbit" | "entity" | "relationship";

// Space/Orbit/Entity share the same tags/metadata shape and are the only types that
// carry them — Relationship gets notes but no tags/metadata, per plan.md decision #11.
export type GroupTargetType = "space" | "orbit" | "entity";
