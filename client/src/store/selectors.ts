import { add } from "@/lib/vector3";
import type { ModelState } from "./store";
import type { Entity, Orbit, Project, Relationship, Space, Tab, Vector3 } from "./types";

export function allProjects(state: ModelState): Project[] {
  return [...state.projects.values()];
}

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

export function entitiesInProject(state: ModelState, projectId: string): Entity[] {
  const spaceIds = new Set(spacesInProject(state, projectId).map((s) => s.id));
  return [...state.entities.values()].filter((e) => spaceIds.has(e.spaceId));
}

export function relationshipsInProject(state: ModelState, projectId: string): Relationship[] {
  const entityIds = new Set(entitiesInProject(state, projectId).map((e) => e.id));
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

type SearchableState = Pick<ModelState, "projects" | "spaces" | "orbits" | "entities">;
type TaggableState = Pick<ModelState, "spaces" | "orbits">;

// Relationships have no `name` field in the data model, so they're excluded from title search.
export function searchByTitle(state: SearchableState, query: string): SearchResult[] {
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
// Keyed lowercase so lookup is case-insensitive, matching searchByTitle's behavior.
export function buildTagIndex(state: TaggableState): Map<string, Set<string>> {
  const index = new Map<string, Set<string>>();
  const addAll = (items: Iterable<{ id: string; tags: string[] }>) => {
    for (const item of items) {
      for (const tag of item.tags) {
        const key = tag.toLowerCase();
        if (!index.has(key)) index.set(key, new Set());
        index.get(key)!.add(item.id);
      }
    }
  };
  addAll(state.spaces.values());
  addAll(state.orbits.values());
  return index;
}

// Exact match (not substring) — tags are a keyword index, unlike title search's fuzzy match.
export function searchByTag(state: TaggableState, tag: string): string[] {
  return [...(buildTagIndex(state).get(tag.trim().toLowerCase()) ?? [])];
}

// Combines title (fuzzy) and tag (exact) matches into one result list for a single search box —
// the two indices stay conceptually separate (plan.md decision #11), this just merges their output.
export function searchAll(state: SearchableState, query: string): SearchResult[] {
  const titleResults = searchByTitle(state, query);
  const seen = new Set(titleResults.map((r) => r.id));

  const results = [...titleResults];
  for (const id of searchByTag(state, query)) {
    if (seen.has(id)) continue;
    seen.add(id);
    const space = state.spaces.get(id);
    if (space) {
      results.push({ id, type: "space", name: space.name });
      continue;
    }
    const orbit = state.orbits.get(id);
    if (orbit) results.push({ id, type: "orbit", name: orbit.name });
  }
  return results;
}

// Resolves a tab's display label from the object it points at. Relationships have no name field,
// so they're labeled by their endpoints instead (e.g. "Node 1 -> Node 2").
export function tabLabel(state: ModelState, tab: Tab): string {
  if (tab.type === "entity") return state.entities.get(tab.id)?.name ?? "Unknown entity";

  if (tab.type === "orbit") {
    const orbit = state.orbits.get(tab.id);
    return orbit?.label ?? orbit?.name ?? "Unknown orbit";
  }

  if (tab.type === "space") {
    const space = state.spaces.get(tab.id);
    return space?.label ?? space?.name ?? "Unknown space";
  }

  const relationship = state.relationships.get(tab.id);
  if (!relationship) return "Unknown relationship";
  const source = state.entities.get(relationship.sourceId)?.name ?? "?";
  const target = state.entities.get(relationship.targetId)?.name ?? "?";
  return `${source} → ${target}`;
}
