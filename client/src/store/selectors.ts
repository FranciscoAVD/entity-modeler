import { add } from "@/lib/vector3";
import type { ModelState } from "./store";
import type { Entity, Orbit, Project, Relationship, Space, Tab, Vector3 } from "./types";

// Resolves tag ids (as stored on a space/orbit/entity/relationship) to their current display
// names via the shared registry — dangling ids (e.g. a mid-render deleteTag race) are dropped
// rather than surfaced as "undefined".
export function tagNamesForIds(state: Pick<ModelState, "tags">, tagIds: string[]): string[] {
  return tagIds.map((id) => state.tags.get(id)?.name).filter((name): name is string => name !== undefined);
}

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

export function projectIdForEntity(state: ModelState, entityId: string): string | undefined {
  const entity = state.entities.get(entityId);
  if (!entity) return undefined;
  return state.spaces.get(entity.spaceId)?.projectId;
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

export interface SpaceDeleteImpact {
  orbits: number;
  entities: number;
  relationships: number;
}

// Used only for cascade-confirmation dialog messaging — store.ts's deleteSpace keeps its own
// inline cascade logic, this just previews the same shape before the user commits to it.
export function spaceDeleteImpact(state: ModelState, spaceId: string): SpaceDeleteImpact {
  const entities = entitiesInSpace(state, spaceId);
  const relationshipIds = new Set<string>();
  for (const entity of entities) {
    for (const rel of relationshipsForEntity(state, entity.id)) relationshipIds.add(rel.id);
  }

  return {
    orbits: orbitsInSpace(state, spaceId).length,
    entities: entities.length,
    relationships: relationshipIds.size,
  };
}

// Same preview purpose as spaceDeleteImpact, for deleteEntity's cascade (its relationships).
export function entityDeleteImpact(state: ModelState, entityId: string): { relationships: number } {
  return { relationships: relationshipsForEntity(state, entityId).length };
}

export interface SearchResult {
  id: string;
  type: "project" | "space" | "orbit" | "entity";
  name: string;
}

type SearchableState = Pick<ModelState, "projects" | "spaces" | "orbits" | "entities" | "tags">;
type TaggableState = Pick<ModelState, "spaces" | "orbits" | "entities" | "tags">;

// Relationships have no `name` field in the data model, so they're excluded from title search.
// Scoped to a single project — previously this matched across every project's data regardless
// of which one was active (a standing open question in plan.md), which read as odd once tags
// (see buildTagIndex below) became project-scoped: a title match from an unrelated project would
// show up right next to a tag search that could no longer cross projects at all.
export function searchByTitle(state: SearchableState, query: string, projectId: string): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const results: SearchResult[] = [];
  const project = state.projects.get(projectId);
  if (project && project.name.toLowerCase().includes(q)) {
    results.push({ id: project.id, type: "project", name: project.name });
  }

  const spaceIds = new Set<string>();
  for (const s of state.spaces.values()) {
    if (s.projectId !== projectId) continue;
    spaceIds.add(s.id);
    if (s.name.toLowerCase().includes(q)) results.push({ id: s.id, type: "space", name: s.name });
  }
  for (const o of state.orbits.values()) {
    if (!spaceIds.has(o.spaceId)) continue;
    if (o.name.toLowerCase().includes(q)) results.push({ id: o.id, type: "orbit", name: o.name });
  }
  for (const e of state.entities.values()) {
    if (!spaceIds.has(e.spaceId)) continue;
    if (e.name.toLowerCase().includes(q)) results.push({ id: e.id, type: "entity", name: e.name });
  }
  return results;
}

// Recomputed on demand rather than incrementally maintained. Keyed lowercase so lookup is
// case-insensitive, matching searchByTitle's behavior. Tags are stored as ids (plan.md decision
// #11's normalized registry) — this resolves each id back to its current name via `state.tags`,
// so a renamed tag is picked up automatically without touching any space/orbit/entity. Scoped to
// a single project: since tag identity is (projectId, name), gating on `tag.projectId` here is
// sufficient — a space/orbit/entity outside that project can never hold one of its tag ids in
// the first place, so there's no need to separately filter the objects being indexed.
export function buildTagIndex(state: TaggableState, projectId: string): Map<string, Set<string>> {
  const index = new Map<string, Set<string>>();
  const addAll = (items: Iterable<{ id: string; tagIds: string[] }>) => {
    for (const item of items) {
      for (const tagId of item.tagIds) {
        const tag = state.tags.get(tagId);
        if (!tag || tag.projectId !== projectId) continue;
        const key = tag.name.toLowerCase();
        if (!index.has(key)) index.set(key, new Set());
        index.get(key)!.add(item.id);
      }
    }
  };
  addAll(state.spaces.values());
  addAll(state.orbits.values());
  addAll(state.entities.values());
  return index;
}

// Exact match (not substring) — tags are a keyword index, unlike title search's fuzzy match.
export function searchByTag(state: TaggableState, tag: string, projectId: string): string[] {
  return [...(buildTagIndex(state, projectId).get(tag.trim().toLowerCase()) ?? [])];
}

// Combines title (fuzzy) and tag (exact) matches into one result list for a single search box —
// the two indices stay conceptually separate (plan.md decision #11), this just merges their
// output. Both scoped to the same project now (see searchByTitle/buildTagIndex above).
export function searchAll(state: SearchableState, query: string, projectId: string): SearchResult[] {
  const titleResults = searchByTitle(state, query, projectId);
  const seen = new Set(titleResults.map((r) => r.id));

  const results = [...titleResults];
  for (const id of searchByTag(state, query, projectId)) {
    if (seen.has(id)) continue;
    seen.add(id);
    const space = state.spaces.get(id);
    if (space) {
      results.push({ id, type: "space", name: space.name });
      continue;
    }
    const orbit = state.orbits.get(id);
    if (orbit) {
      results.push({ id, type: "orbit", name: orbit.name });
      continue;
    }
    const entity = state.entities.get(id);
    if (entity) results.push({ id, type: "entity", name: entity.name });
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
