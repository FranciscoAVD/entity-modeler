// Plain vector, not THREE.Vector3 — the data model stays independent of the renderer (plan.md decision #5).
export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Note {
  id: string;
  text: string;
  author?: string;
  createdAt: number;
  metadata?: Record<string, string | number>;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  notes: Note[];
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

export interface Field {
  id: string;
  name: string;
  type: string;
  isPK?: boolean;
  isFK?: boolean;
}

export interface Entity {
  id: string;
  spaceId: string;
  orbitId?: string;
  name: string;
  fields: Field[];
  position: Vector3;
  notes: Note[];
}

export type Cardinality = "1:1" | "1:N" | "N:M";

export interface Relationship {
  id: string;
  sourceId: string;
  targetId: string;
  cardinality: Cardinality;
  notes: Note[];
}

export type TabType = "entity" | "relationship" | "orbit";

export interface Tab {
  id: string;
  type: TabType;
}

export type NoteTargetType = "project" | "space" | "orbit" | "entity" | "relationship";
