import { add } from "@/lib/vector3";
import type { ModelState } from "./store";
import type { Entity, Orbit, Relationship, Space, Vector3 } from "./types";

export function spacesInProject(state: ModelState, projectId: string): Space[] {
  return [...state.spaces.values()].filter((s) => s.projectId === projectId);
}

export function orbitsInSpace(state: ModelState, spaceId: string): Orbit[] {
  return [...state.orbits.values()].filter((o) => o.spaceId === spaceId);
}

export function entitiesInSpace(state: ModelState, spaceId: string): Entity[] {
  return [...state.entities.values()].filter((e) => e.spaceId === spaceId);
}

export function entitiesInOrbit(state: ModelState, orbitId: string): Entity[] {
  return [...state.entities.values()].filter((e) => e.orbitId === orbitId);
}

export function ungroupedEntitiesInSpace(state: ModelState, spaceId: string): Entity[] {
  return entitiesInSpace(state, spaceId).filter((e) => e.orbitId === undefined);
}

export function relationshipsForEntity(state: ModelState, entityId: string): Relationship[] {
  return [...state.relationships.values()].filter(
    (r) => r.sourceId === entityId || r.targetId === entityId,
  );
}

export function relationshipsInProject(state: ModelState, projectId: string): Relationship[] {
  const spaceIds = new Set(spacesInProject(state, projectId).map((s) => s.id));
  const entityIds = new Set(
    [...state.entities.values()].filter((e) => spaceIds.has(e.spaceId)).map((e) => e.id),
  );
  return [...state.relationships.values()].filter(
    (r) => entityIds.has(r.sourceId) && entityIds.has(r.targetId),
  );
}

export type RelationshipScope = "local" | "cross-orbit" | "cross-space";

// "local" covers both same-orbit edges and edges between two ungrouped entities in the same
// space — neither crosses an orbit boundary, so both get the same (most contained) styling tier.
export function relationshipScope(state: ModelState, relationshipId: string): RelationshipScope {
  const relationship = state.relationships.get(relationshipId);
  if (!relationship) throw new Error(`Relationship not found: ${relationshipId}`);

  const source = state.entities.get(relationship.sourceId);
  const target = state.entities.get(relationship.targetId);
  if (!source || !target) throw new Error(`Relationship ${relationshipId} has a dangling endpoint`);

  if (source.spaceId !== target.spaceId) return "cross-space";
  if (source.orbitId !== target.orbitId) return "cross-orbit";
  return "local";
}

// Walks entity.position -> orbit.origin (if assigned) -> space.origin, per plan.md's position-resolution rule.
export function getWorldPosition(state: ModelState, entityId: string): Vector3 {
  const entity = state.entities.get(entityId);
  if (!entity) throw new Error(`Entity not found: ${entityId}`);

  const space = state.spaces.get(entity.spaceId);
  if (!space) throw new Error(`Space not found for entity ${entityId}: ${entity.spaceId}`);

  const orbitOrigin = entity.orbitId ? state.orbits.get(entity.orbitId)?.origin : undefined;

  let position = entity.position;
  if (orbitOrigin) position = add(position, orbitOrigin);
  return add(position, space.origin);
}

export function getOrbitWorldOrigin(state: ModelState, orbitId: string): Vector3 {
  const orbit = state.orbits.get(orbitId);
  if (!orbit) throw new Error(`Orbit not found: ${orbitId}`);

  const space = state.spaces.get(orbit.spaceId);
  if (!space) throw new Error(`Space not found for orbit ${orbitId}: ${orbit.spaceId}`);

  return add(orbit.origin, space.origin);
}

export interface SearchResult {
  id: string;
  type: "project" | "space" | "orbit" | "entity";
  name: string;
}

// Relationships have no `name` field in the data model, so they're excluded from title search.
export function searchByTitle(state: ModelState, query: string): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const results: SearchResult[] = [];
  for (const p of state.projects.values()) {
    if (p.name.toLowerCase().includes(q)) results.push({ id: p.id, type: "project", name: p.name });
  }
  for (const s of state.spaces.values()) {
    if (s.name.toLowerCase().includes(q)) results.push({ id: s.id, type: "space", name: s.name });
  }
  for (const o of state.orbits.values()) {
    if (o.name.toLowerCase().includes(q)) results.push({ id: o.id, type: "orbit", name: o.name });
  }
  for (const e of state.entities.values()) {
    if (e.name.toLowerCase().includes(q)) results.push({ id: e.id, type: "entity", name: e.name });
  }
  return results;
}

// Tags are a space/orbit-only concept; recomputed on demand rather than incrementally maintained.
export function buildTagIndex(state: ModelState): Map<string, Set<string>> {
  const index = new Map<string, Set<string>>();
  const addAll = (items: Iterable<{ id: string; tags: string[] }>) => {
    for (const item of items) {
      for (const tag of item.tags) {
        if (!index.has(tag)) index.set(tag, new Set());
        index.get(tag)!.add(item.id);
      }
    }
  };
  addAll(state.spaces.values());
  addAll(state.orbits.values());
  return index;
}

export function searchByTag(state: ModelState, tag: string): string[] {
  return [...(buildTagIndex(state).get(tag) ?? [])];
}
