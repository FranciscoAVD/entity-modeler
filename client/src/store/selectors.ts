import { add } from "@/lib/vector3";
import type { ModelState } from "./store";
import type { Node, Orbit, Project, Relationship, Space, Tab, Tag, Vector3 } from "./types";

// Resolves tag ids (as stored on a space/orbit/node/relationship) to their current display
// names via the shared registry — dangling ids (e.g. a mid-render deleteTag race) are dropped
// rather than surfaced as "undefined".
export function tagNamesForIds(state: Pick<ModelState, "tags">, tagIds: string[]): string[] {
  return tagIds.map((id) => state.tags.get(id)?.name).filter((name): name is string => name !== undefined);
}

// Every tag belonging to a project (tag identity is (projectId, name), see plan.md decision
// #11), sorted by name for a stable, browsable list — the tag registry UI's main listing.
export function tagsInProject(state: Pick<ModelState, "tags">, projectId: string): Tag[] {
  return [...state.tags.values()]
    .filter((t) => t.projectId === projectId)
    .sort((a, b) => a.name.localeCompare(b.name));
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

export function nodesInSpace(state: ModelState, spaceId: string): Node[] {
  return [...state.nodes.values()].filter((e) => e.spaceId === spaceId);
}

export function nodesInOrbit(state: ModelState, orbitId: string): Node[] {
  return [...state.nodes.values()].filter((e) => e.orbitId === orbitId);
}

export function ungroupedNodesInSpace(state: ModelState, spaceId: string): Node[] {
  return nodesInSpace(state, spaceId).filter((e) => e.orbitId === undefined);
}

export function relationshipsForNode(state: ModelState, nodeId: string): Relationship[] {
  return [...state.relationships.values()].filter(
    (r) => r.sourceId === nodeId || r.targetId === nodeId,
  );
}

export function nodesInProject(state: ModelState, projectId: string): Node[] {
  const spaceIds = new Set(spacesInProject(state, projectId).map((s) => s.id));
  return [...state.nodes.values()].filter((e) => spaceIds.has(e.spaceId));
}

export function projectIdForNode(state: ModelState, nodeId: string): string | undefined {
  const node = state.nodes.get(nodeId);
  if (!node) return undefined;
  return state.spaces.get(node.spaceId)?.projectId;
}

export function projectIdForOrbit(state: ModelState, orbitId: string): string | undefined {
  const orbit = state.orbits.get(orbitId);
  if (!orbit) return undefined;
  return state.spaces.get(orbit.spaceId)?.projectId;
}

export function relationshipsInProject(state: ModelState, projectId: string): Relationship[] {
  const nodeIds = new Set(nodesInProject(state, projectId).map((e) => e.id));
  return [...state.relationships.values()].filter(
    (r) => nodeIds.has(r.sourceId) && nodeIds.has(r.targetId),
  );
}

export type RelationshipScope = "local" | "cross-orbit" | "cross-space";

// "local" covers both same-orbit edges and edges between two ungrouped nodes in the same
// space — neither crosses an orbit boundary, so both get the same (most contained) styling tier.
export function relationshipScope(state: ModelState, relationshipId: string): RelationshipScope {
  const relationship = state.relationships.get(relationshipId);
  if (!relationship) throw new Error(`Relationship not found: ${relationshipId}`);

  const source = state.nodes.get(relationship.sourceId);
  const target = state.nodes.get(relationship.targetId);
  if (!source || !target) throw new Error(`Relationship ${relationshipId} has a dangling endpoint`);

  if (source.spaceId !== target.spaceId) return "cross-space";
  if (source.orbitId !== target.orbitId) return "cross-orbit";
  return "local";
}

// Walks node.position -> orbit.origin (if assigned) -> space.origin, per plan.md's position-resolution rule.
export function getWorldPosition(state: ModelState, nodeId: string): Vector3 {
  const node = state.nodes.get(nodeId);
  if (!node) throw new Error(`Node not found: ${nodeId}`);

  const space = state.spaces.get(node.spaceId);
  if (!space) throw new Error(`Space not found for node ${nodeId}: ${node.spaceId}`);

  const orbitOrigin = node.orbitId ? state.orbits.get(node.orbitId)?.origin : undefined;

  let position = node.position;
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
  nodes: number;
  relationships: number;
}

// Used only for cascade-confirmation dialog messaging — store.ts's deleteSpace keeps its own
// inline cascade logic, this just previews the same shape before the user commits to it.
export function spaceDeleteImpact(state: ModelState, spaceId: string): SpaceDeleteImpact {
  const nodes = nodesInSpace(state, spaceId);
  const relationshipIds = new Set<string>();
  for (const node of nodes) {
    for (const rel of relationshipsForNode(state, node.id)) relationshipIds.add(rel.id);
  }

  return {
    orbits: orbitsInSpace(state, spaceId).length,
    nodes: nodes.length,
    relationships: relationshipIds.size,
  };
}

// Same preview purpose as spaceDeleteImpact, for deleteNode's cascade (its relationships).
export function nodeDeleteImpact(state: ModelState, nodeId: string): { relationships: number } {
  return { relationships: relationshipsForNode(state, nodeId).length };
}

export interface SearchResult {
  id: string;
  type: "space" | "orbit" | "node" | "tag";
  name: string;
}

type SearchableState = Pick<ModelState, "spaces" | "orbits" | "nodes" | "tags">;

// Relationships have no `name` field in the data model, so they're excluded from title search.
// Projects are excluded too — the search box lives inside one project's sidebar, and project
// switching already has its own UI (the Header's project switcher). Scoped to a single project —
// previously this matched across every project's data regardless of which one was active (a
// standing open question in plan.md), which read as odd once tags became project-scoped: a title
// match from an unrelated project would show up right next to a tag match that could no longer
// cross projects at all.
export function searchByTitle(state: SearchableState, query: string, projectId: string): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const results: SearchResult[] = [];
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
  for (const e of state.nodes.values()) {
    if (!spaceIds.has(e.spaceId)) continue;
    if (e.name.toLowerCase().includes(q)) results.push({ id: e.id, type: "node", name: e.name });
  }
  return results;
}

// Fuzzy (substring) match against tag *names* in the project, same matching approach as
// searchByTitle — tags are now their own top-level search category (a Tags section in the search
// dropdown) rather than resolving directly to the objects that carry them; clicking a tag result
// drills into those objects separately (see objectsForTag below), the same way clicking a space/
// orbit result doesn't also list its nodes inline.
export function searchTags(state: Pick<ModelState, "tags">, query: string, projectId: string): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const results: SearchResult[] = [];
  for (const tag of state.tags.values()) {
    if (tag.projectId !== projectId) continue;
    if (tag.name.toLowerCase().includes(q)) results.push({ id: tag.id, type: "tag", name: tag.name });
  }
  return results;
}

// Every space/orbit/node carrying a specific tag id, resolved to a displayable/focusable shape
// — backs the "what does this tag apply to" dialog opened from a Tags search result. Relationships
// aren't included — no name field to show, no sidebar row (plan.md decision #11).
export function objectsForTag(
  state: Pick<ModelState, "spaces" | "orbits" | "nodes">,
  tagId: string,
): SearchResult[] {
  const results: SearchResult[] = [];
  for (const s of state.spaces.values()) {
    if (s.tagIds.includes(tagId)) results.push({ id: s.id, type: "space", name: s.name });
  }
  for (const o of state.orbits.values()) {
    if (o.tagIds.includes(tagId)) results.push({ id: o.id, type: "orbit", name: o.name });
  }
  for (const e of state.nodes.values()) {
    if (e.tagIds.includes(tagId)) results.push({ id: e.id, type: "node", name: e.name });
  }
  return results;
}

// Combines tag and title matches into one result list for a single search box — tags first, so
// the UI can group results into Tags/Spaces/Orbits/Nodes sections (tags always on top) just by
// filtering on `.type`. Both scoped to the same project (see searchByTitle/searchTags above).
export function searchAll(state: SearchableState, query: string, projectId: string): SearchResult[] {
  return [...searchTags(state, query, projectId), ...searchByTitle(state, query, projectId)];
}

// Resolves a tab's display label from the object it points at. Relationships have no name field,
// so they're labeled by their endpoints instead (e.g. "Node 1 -> Node 2").
export function tabLabel(state: ModelState, tab: Tab): string {
  if (tab.type === "node") return state.nodes.get(tab.id)?.name ?? "Unknown node";

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
  const source = state.nodes.get(relationship.sourceId)?.name ?? "?";
  const target = state.nodes.get(relationship.targetId)?.name ?? "?";
  return `${source} → ${target}`;
}
