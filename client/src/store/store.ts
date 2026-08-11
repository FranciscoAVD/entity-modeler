import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { ProjectDetail } from "shared";
import { autoLayoutProject } from "@/scene/autoLayout";
import { projectIdForNode, projectIdForOrbit, spacesInProject } from "./selectors";
import type {
  Cardinality,
  Node,
  Note,
  NoteTargetType,
  Orbit,
  Project,
  Relationship,
  Space,
  Tab,
  TabType,
  Tag,
  Vector3,
} from "./types";

const ORIGIN: Vector3 = { x: 0, y: 0, z: 0 };

export interface ModelState {
  projects: Map<string, Project>;
  spaces: Map<string, Space>;
  orbits: Map<string, Orbit>;
  nodes: Map<string, Node>;
  relationships: Map<string, Relationship>;
  tags: Map<string, Tag>;

  openTabs: Tab[];
  activeTabId: string | null;
}

export interface ModelActions {
  hydrateProject(detail: ProjectDetail): void;
  addProject(input: { name: string; description?: string }): string;
  addSpace(input: {
    projectId: string;
    name: string;
    label?: string;
    tags?: string[];
    metadata?: Record<string, string | number>;
  }): string;
  addOrbit(input: {
    spaceId: string;
    name: string;
    label?: string;
    tags?: string[];
    metadata?: Record<string, string | number>;
  }): string;
  addNode(input: {
    spaceId: string;
    orbitId?: string;
    name: string;
    tags?: string[];
    metadata?: Record<string, string | number>;
  }): string;
  addRelationship(input: {
    sourceId: string;
    targetId: string;
    cardinality: Cardinality;
    tags?: string[];
    metadata?: Record<string, string | number>;
  }): string;
  updateRelationshipCardinality(relationshipId: string, cardinality: Cardinality): void;
  updateRelationshipEndpoints(
    relationshipId: string,
    endpoints: { sourceId: string; targetId: string },
  ): void;

  moveNode(nodeId: string, target: { spaceId: string; orbitId?: string }): void;
  renameSpace(spaceId: string, name: string): void;
  renameOrbit(orbitId: string, name: string): void;
  renameNode(nodeId: string, name: string): void;

  updateSpaceTags(spaceId: string, tags: string[]): void;
  updateOrbitTags(orbitId: string, tags: string[]): void;
  updateNodeTags(nodeId: string, tags: string[]): void;
  updateRelationshipTags(relationshipId: string, tags: string[]): void;
  renameTag(tagId: string, name: string): void;
  deleteTag(tagId: string): void;
  updateSpaceMetadata(spaceId: string, metadata: Record<string, string | number> | undefined): void;
  updateOrbitMetadata(orbitId: string, metadata: Record<string, string | number> | undefined): void;
  updateNodeMetadata(nodeId: string, metadata: Record<string, string | number> | undefined): void;
  updateRelationshipMetadata(
    relationshipId: string,
    metadata: Record<string, string | number> | undefined,
  ): void;

  deleteProject(projectId: string): void;
  deleteSpace(spaceId: string): void;
  deleteOrbit(orbitId: string): void;
  deleteNode(nodeId: string): void;
  deleteRelationship(relationshipId: string): void;

  addNote(
    targetType: NoteTargetType,
    targetId: string,
    note: { title: string; text: string; author?: string },
  ): string;
  updateNote(
    targetType: NoteTargetType,
    targetId: string,
    noteId: string,
    patch: { title: string; text: string },
  ): void;
  deleteNote(targetType: NoteTargetType, targetId: string, noteId: string): void;

  openTab(id: string, type: TabType): void;
  setActiveTab(id: string): void;
  clearActiveTab(): void;
}

// Recently-viewed history is capped rather than a user-managed open/close list — the sidebar's
// tab picker just shows "last N viewed", so the oldest entry quietly falls off instead of
// requiring an explicit close action.
const MAX_RECENT_TABS = 5;

// Removing entries (only ever via cascade delete now, since there's no manual close) hands the
// active slot to the next remaining tab after it, falling back to the previous one.
function pruneTabs(
  openTabs: Tab[],
  activeTabId: string | null,
  removedIds: Set<string>,
): { openTabs: Tab[]; activeTabId: string | null } {
  const activeIdx = openTabs.findIndex((t) => t.id === activeTabId);
  const remaining = openTabs.filter((t) => !removedIds.has(t.id));

  let nextActiveTabId = activeTabId;
  if (activeTabId !== null && removedIds.has(activeTabId)) {
    const after = openTabs.slice(activeIdx + 1).find((t) => !removedIds.has(t.id));
    nextActiveTabId = after ? after.id : (remaining.at(-1)?.id ?? null);
  }

  return { openTabs: remaining, activeTabId: nextActiveTabId };
}

// Resolves user-typed tag names (from TagEditor, or an add*'s `tags` input) against the tag
// registry (plan.md decision #11), scoped to a single project — reusing an existing tag in that
// project (matched case-insensitively) if one exists, creating it otherwise. This is the
// "normalize on write" step: every space/orbit/node/relationship ends up referencing tags by
// id, so renaming a tag only ever touches the registry once instead of every object that
// carries it. Tag identity is (projectId, name) — the same name in a different project resolves
// to a different tag entirely, never reused across projects.
function resolveTagIds(
  tags: Map<string, Tag>,
  names: string[],
  projectId: string,
): { tagIds: string[]; tags: Map<string, Tag> } {
  const nextTags = new Map(tags);
  const idByName = new Map(
    [...tags.values()]
      .filter((t) => t.projectId === projectId)
      .map((t) => [t.name.toLowerCase(), t.id]),
  );
  const tagIds: string[] = [];

  for (const rawName of names) {
    const name = rawName.trim();
    if (!name) continue;

    const key = name.toLowerCase();
    let id = idByName.get(key);
    if (!id) {
      id = crypto.randomUUID();
      nextTags.set(id, { id, projectId, name });
      idByName.set(key, id);
    }
    if (!tagIds.includes(id)) tagIds.push(id);
  }

  return { tagIds, tags: nextTags };
}

// Shared by addNote/updateNote/deleteNote — all three are "look up the record by type,
// replace its notes array" with a different updater, so the type-dispatch and copy-map-set
// mechanics only need to exist once.
function withNotes<T extends { notes: Note[] }>(
  map: Map<string, T>,
  targetId: string,
  updater: (notes: Note[]) => Note[],
): Map<string, T> {
  const record = map.get(targetId);
  if (!record) throw new Error(`Not found: ${targetId}`);
  const next = new Map(map);
  next.set(targetId, { ...record, notes: updater(record.notes) });
  return next;
}

function notesPatch(
  state: ModelState,
  targetType: NoteTargetType,
  targetId: string,
  updater: (notes: Note[]) => Note[],
): Partial<ModelState> {
  switch (targetType) {
    case "space":
      return { spaces: withNotes(state.spaces, targetId, updater) };
    case "orbit":
      return { orbits: withNotes(state.orbits, targetId, updater) };
    case "node":
      return { nodes: withNotes(state.nodes, targetId, updater) };
    case "relationship":
      return { relationships: withNotes(state.relationships, targetId, updater) };
  }
}

// subscribeWithSelector so Layer 5's autosave (persistence.ts) can subscribe to just the five
// data Maps with a shallow-equality check, rather than firing on every store change — openTab/
// setActiveTab/clearActiveTab touch openTabs/activeTabId, session/view state that's never
// persisted and must not trigger a save.
export const useModelStore = create<ModelState & ModelActions>()(subscribeWithSelector((set, get) => ({
  projects: new Map(),
  spaces: new Map(),
  orbits: new Map(),
  nodes: new Map(),
  relationships: new Map(),
  tags: new Map(),
  openTabs: [],
  activeTabId: null,

  // Populates the five data Maps for one project from a server-fetched nested tree (the inverse
  // of serialize.ts's serializeProject) — merges into existing state by id, rather than
  // replacing it outright, so switching projects accumulates data instead of evicting whatever
  // was already loaded (plan.md: "once fetched, stays in the store"). Doesn't touch
  // openTabs/activeTabId — those are session/view state, not part of what the server persists.
  hydrateProject(detail) {
    const state = get();

    const projects = new Map(state.projects);
    projects.set(detail.project.id, detail.project);

    const tags = new Map(state.tags);
    for (const tag of detail.tags) tags.set(tag.id, tag);

    const spaces = new Map(state.spaces);
    for (const s of detail.spaces) spaces.set(s.id, s);

    const orbits = new Map(state.orbits);
    for (const o of detail.orbits) orbits.set(o.id, o);

    const nodes = new Map(state.nodes);
    for (const n of detail.nodes) nodes.set(n.id, n);

    const relationships = new Map(state.relationships);
    for (const r of detail.relationships) relationships.set(r.id, r);

    set({ projects, spaces, orbits, nodes, relationships, tags });
  },

  addProject({ name, description }) {
    const id = crypto.randomUUID();
    const projects = new Map(get().projects);
    projects.set(id, { id, name, description });
    set({ projects });
    return id;
  },

  addSpace({ projectId, name, label, tags, metadata }) {
    const state = get();
    if (!state.projects.has(projectId)) throw new Error(`Project not found: ${projectId}`);

    const { tagIds, tags: nextTags } = resolveTagIds(state.tags, tags ?? [], projectId);
    const id = crypto.randomUUID();
    const spaces = new Map(state.spaces);
    spaces.set(id, { id, projectId, name, label, origin: ORIGIN, tagIds, notes: [], metadata });

    set({ ...autoLayoutProject({ ...state, spaces }, projectId), tags: nextTags });
    return id;
  },

  addOrbit({ spaceId, name, label, tags, metadata }) {
    const state = get();
    const parentSpace = state.spaces.get(spaceId);
    if (!parentSpace) throw new Error(`Space not found: ${spaceId}`);

    const { tagIds, tags: nextTags } = resolveTagIds(state.tags, tags ?? [], parentSpace.projectId);
    const id = crypto.randomUUID();
    const orbits = new Map(state.orbits);
    orbits.set(id, { id, spaceId, name, label, origin: ORIGIN, tagIds, notes: [], metadata });

    set({ ...autoLayoutProject({ ...state, orbits }, parentSpace.projectId), tags: nextTags });
    return id;
  },

  addNode({ spaceId, orbitId, name, tags, metadata }) {
    const state = get();
    const parentSpace = state.spaces.get(spaceId);
    if (!parentSpace) throw new Error(`Space not found: ${spaceId}`);
    if (orbitId !== undefined) {
      const orbit = state.orbits.get(orbitId);
      if (!orbit) throw new Error(`Orbit not found: ${orbitId}`);
      if (orbit.spaceId !== spaceId) {
        throw new Error(`Orbit ${orbitId} does not belong to space ${spaceId}`);
      }
    }

    const { tagIds, tags: nextTags } = resolveTagIds(state.tags, tags ?? [], parentSpace.projectId);
    const id = crypto.randomUUID();
    const nodes = new Map(state.nodes);
    nodes.set(id, { id, spaceId, orbitId, name, tagIds, position: ORIGIN, notes: [], metadata });

    set({ ...autoLayoutProject({ ...state, nodes }, parentSpace.projectId), tags: nextTags });
    return id;
  },

  addRelationship({ sourceId, targetId, cardinality, tags, metadata }) {
    if (sourceId === targetId) throw new Error("A relationship cannot connect a node to itself");

    const state = get();
    if (!state.nodes.has(sourceId)) throw new Error(`Node not found: ${sourceId}`);
    if (!state.nodes.has(targetId)) throw new Error(`Node not found: ${targetId}`);

    const projectId = projectIdForNode(state, sourceId);
    if (!projectId) throw new Error(`Project not found for node: ${sourceId}`);

    const { tagIds, tags: nextTags } = resolveTagIds(state.tags, tags ?? [], projectId);
    const id = crypto.randomUUID();
    const relationships = new Map(state.relationships);
    relationships.set(id, {
      id,
      sourceId,
      targetId,
      cardinality,
      tagIds,
      notes: [],
      metadata,
    });
    set({ ...autoLayoutProject({ ...state, relationships }, projectId), relationships, tags: nextTags });
    return id;
  },

  updateRelationshipCardinality(relationshipId, cardinality) {
    const state = get();
    const relationship = state.relationships.get(relationshipId);
    if (!relationship) throw new Error(`Relationship not found: ${relationshipId}`);

    const relationships = new Map(state.relationships);
    relationships.set(relationshipId, { ...relationship, cardinality });
    set({ relationships });
  },

  updateRelationshipEndpoints(relationshipId, { sourceId, targetId }) {
    if (sourceId === targetId) throw new Error("A relationship cannot connect a node to itself");

    const state = get();
    const relationship = state.relationships.get(relationshipId);
    if (!relationship) throw new Error(`Relationship not found: ${relationshipId}`);
    if (!state.nodes.has(sourceId)) throw new Error(`Node not found: ${sourceId}`);
    if (!state.nodes.has(targetId)) throw new Error(`Node not found: ${targetId}`);

    const relationships = new Map(state.relationships);
    relationships.set(relationshipId, { ...relationship, sourceId, targetId });

    const projectId = projectIdForNode(state, sourceId);
    if (!projectId) throw new Error(`Project not found for node: ${sourceId}`);
    set({ ...autoLayoutProject({ ...state, relationships }, projectId), relationships });
  },

  // Re-parenting is the *only* way a user influences position — there's no manual coordinate
  // entry or dragging (plan.md Phase 7). autoLayoutProject recomputes every position in the
  // target project from scratch afterward, so this just needs to reassign spaceId/orbitId; any
  // "preserve the old local offset" math would be immediately overwritten anyway.
  moveNode(nodeId, { spaceId, orbitId }) {
    const state = get();
    const node = state.nodes.get(nodeId);
    if (!node) throw new Error(`Node not found: ${nodeId}`);
    const newSpace = state.spaces.get(spaceId);
    if (!newSpace) throw new Error(`Space not found: ${spaceId}`);
    if (orbitId !== undefined) {
      const orbit = state.orbits.get(orbitId);
      if (!orbit) throw new Error(`Orbit not found: ${orbitId}`);
      if (orbit.spaceId !== spaceId) {
        throw new Error(`Orbit ${orbitId} does not belong to space ${spaceId}`);
      }
    }

    const nodes = new Map(state.nodes);
    nodes.set(nodeId, { ...node, spaceId, orbitId });
    set(autoLayoutProject({ ...state, nodes }, newSpace.projectId));
  },

  renameSpace(spaceId, name) {
    const state = get();
    const space = state.spaces.get(spaceId);
    if (!space) throw new Error(`Space not found: ${spaceId}`);

    const spaces = new Map(state.spaces);
    spaces.set(spaceId, { ...space, name });
    set({ spaces });
  },

  renameOrbit(orbitId, name) {
    const state = get();
    const orbit = state.orbits.get(orbitId);
    if (!orbit) throw new Error(`Orbit not found: ${orbitId}`);

    const orbits = new Map(state.orbits);
    orbits.set(orbitId, { ...orbit, name });
    set({ orbits });
  },

  renameNode(nodeId, name) {
    const state = get();
    const node = state.nodes.get(nodeId);
    if (!node) throw new Error(`Node not found: ${nodeId}`);

    const nodes = new Map(state.nodes);
    nodes.set(nodeId, { ...node, name });
    set({ nodes });
  },

  updateSpaceTags(spaceId, tags) {
    const state = get();
    const space = state.spaces.get(spaceId);
    if (!space) throw new Error(`Space not found: ${spaceId}`);

    const { tagIds, tags: nextTags } = resolveTagIds(state.tags, tags, space.projectId);
    const spaces = new Map(state.spaces);
    spaces.set(spaceId, { ...space, tagIds });
    set({ spaces, tags: nextTags });
  },

  updateOrbitTags(orbitId, tags) {
    const state = get();
    const orbit = state.orbits.get(orbitId);
    if (!orbit) throw new Error(`Orbit not found: ${orbitId}`);
    const parentSpace = state.spaces.get(orbit.spaceId);
    if (!parentSpace) throw new Error(`Space not found: ${orbit.spaceId}`);

    const { tagIds, tags: nextTags } = resolveTagIds(state.tags, tags, parentSpace.projectId);
    const orbits = new Map(state.orbits);
    orbits.set(orbitId, { ...orbit, tagIds });
    set({ orbits, tags: nextTags });
  },

  updateNodeTags(nodeId, tags) {
    const state = get();
    const node = state.nodes.get(nodeId);
    if (!node) throw new Error(`Node not found: ${nodeId}`);
    const parentSpace = state.spaces.get(node.spaceId);
    if (!parentSpace) throw new Error(`Space not found: ${node.spaceId}`);

    const { tagIds, tags: nextTags } = resolveTagIds(state.tags, tags, parentSpace.projectId);
    const nodes = new Map(state.nodes);
    nodes.set(nodeId, { ...node, tagIds });
    set({ nodes, tags: nextTags });
  },

  updateRelationshipTags(relationshipId, tags) {
    const state = get();
    const relationship = state.relationships.get(relationshipId);
    if (!relationship) throw new Error(`Relationship not found: ${relationshipId}`);
    const projectId = projectIdForNode(state, relationship.sourceId);
    if (!projectId) throw new Error(`Project not found for node: ${relationship.sourceId}`);

    const { tagIds, tags: nextTags } = resolveTagIds(state.tags, tags, projectId);
    const relationships = new Map(state.relationships);
    relationships.set(relationshipId, { ...relationship, tagIds });
    set({ relationships, tags: nextTags });
  },

  // Renaming only ever touches the registry — every space/orbit/node/relationship references
  // the tag by id, so they all pick up the new name for free. This is the payoff of normalizing.
  renameTag(tagId, name) {
    const state = get();
    const tag = state.tags.get(tagId);
    if (!tag) throw new Error(`Tag not found: ${tagId}`);

    const trimmed = name.trim();
    if (!trimmed) throw new Error("Tag name cannot be empty");

    // Tag identity is (projectId, name) — renaming into a name another tag in the same project
    // already holds would produce two registry entries with the same identity. Merging the two
    // (remapping every tagIds reference onto one id) is a real edge case but out of scope here;
    // this just refuses the collision rather than silently allowing it.
    const collision = [...state.tags.values()].some(
      (t) => t.id !== tagId && t.projectId === tag.projectId && t.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (collision) throw new Error(`A tag named "${trimmed}" already exists in this project`);

    const tags = new Map(state.tags);
    tags.set(tagId, { ...tag, name: trimmed });
    set({ tags });
  },

  // Deleting a tag has to strip it out of every object that referenced it, the same "no dangling
  // reference" rule as deleteSpace's cascade — otherwise a tagId would survive in some tagIds
  // array pointing at a registry entry that no longer exists.
  deleteTag(tagId) {
    const state = get();
    if (!state.tags.has(tagId)) throw new Error(`Tag not found: ${tagId}`);

    const tags = new Map(state.tags);
    tags.delete(tagId);

    const stripTag = <T extends { tagIds: string[] }>(map: Map<string, T>): Map<string, T> => {
      let changed = false;
      const next = new Map(map);
      for (const [id, record] of map) {
        if (record.tagIds.includes(tagId)) {
          next.set(id, { ...record, tagIds: record.tagIds.filter((t) => t !== tagId) });
          changed = true;
        }
      }
      return changed ? next : map;
    };

    set({
      tags,
      spaces: stripTag(state.spaces),
      orbits: stripTag(state.orbits),
      nodes: stripTag(state.nodes),
      relationships: stripTag(state.relationships),
    });
  },

  updateSpaceMetadata(spaceId, metadata) {
    const state = get();
    const space = state.spaces.get(spaceId);
    if (!space) throw new Error(`Space not found: ${spaceId}`);

    const spaces = new Map(state.spaces);
    spaces.set(spaceId, { ...space, metadata });
    set({ spaces });
  },

  updateOrbitMetadata(orbitId, metadata) {
    const state = get();
    const orbit = state.orbits.get(orbitId);
    if (!orbit) throw new Error(`Orbit not found: ${orbitId}`);

    const orbits = new Map(state.orbits);
    orbits.set(orbitId, { ...orbit, metadata });
    set({ orbits });
  },

  updateNodeMetadata(nodeId, metadata) {
    const state = get();
    const node = state.nodes.get(nodeId);
    if (!node) throw new Error(`Node not found: ${nodeId}`);

    const nodes = new Map(state.nodes);
    nodes.set(nodeId, { ...node, metadata });
    set({ nodes });
  },

  updateRelationshipMetadata(relationshipId, metadata) {
    const state = get();
    const relationship = state.relationships.get(relationshipId);
    if (!relationship) throw new Error(`Relationship not found: ${relationshipId}`);

    const relationships = new Map(state.relationships);
    relationships.set(relationshipId, { ...relationship, metadata });
    set({ relationships });
  },

  deleteProject(projectId) {
    const state = get();
    if (!state.projects.has(projectId)) throw new Error(`Project not found: ${projectId}`);

    for (const space of spacesInProject(state, projectId)) {
      get().deleteSpace(space.id);
    }

    const projects = new Map(get().projects);
    projects.delete(projectId);

    // Tags are project-scoped (identity is projectId + name) — unlike deleteSpace's cascade,
    // which just leaves a tag's references stripped and the registry entry itself orphaned but
    // intact (it may still be reused by other objects in the project), a project-scoped tag can
    // never be referenced again once its project is gone, so it's removed outright here.
    const tags = new Map(get().tags);
    for (const [id, tag] of tags) {
      if (tag.projectId === projectId) tags.delete(id);
    }

    set({ projects, tags });
  },

  deleteSpace(spaceId) {
    const state = get();
    const deletedSpace = state.spaces.get(spaceId);
    if (!deletedSpace) throw new Error(`Space not found: ${spaceId}`);
    const projectId = deletedSpace.projectId;

    const orbitIds = new Set(
      [...state.orbits.values()].filter((o) => o.spaceId === spaceId).map((o) => o.id),
    );
    const nodeIds = new Set(
      [...state.nodes.values()].filter((e) => e.spaceId === spaceId).map((e) => e.id),
    );
    const relationshipIds = new Set(
      [...state.relationships.values()]
        .filter((r) => nodeIds.has(r.sourceId) || nodeIds.has(r.targetId))
        .map((r) => r.id),
    );

    const spaces = new Map(state.spaces);
    spaces.delete(spaceId);

    const orbits = new Map(state.orbits);
    for (const id of orbitIds) orbits.delete(id);

    const nodes = new Map(state.nodes);
    for (const id of nodeIds) nodes.delete(id);

    const relationships = new Map(state.relationships);
    for (const id of relationshipIds) relationships.delete(id);

    const removedTabIds = new Set([spaceId, ...orbitIds, ...nodeIds, ...relationshipIds]);
    const { openTabs, activeTabId } = pruneTabs(state.openTabs, state.activeTabId, removedTabIds);

    set({
      ...autoLayoutProject({ ...state, spaces, orbits, nodes, relationships }, projectId),
      relationships,
      openTabs,
      activeTabId,
    });
  },

  deleteOrbit(orbitId) {
    const state = get();
    if (!state.orbits.has(orbitId)) throw new Error(`Orbit not found: ${orbitId}`);
    const projectId = projectIdForOrbit(state, orbitId);
    if (!projectId) throw new Error(`Project not found for orbit: ${orbitId}`);

    const orbits = new Map(state.orbits);
    orbits.delete(orbitId);

    // Nodes aren't owned by their orbit (space is the required parent), so they're
    // reassigned to orbit-less rather than deleted — avoids a dangling orbitId reference.
    const nodes = new Map(state.nodes);
    for (const node of state.nodes.values()) {
      if (node.orbitId === orbitId) nodes.set(node.id, { ...node, orbitId: undefined });
    }

    const { openTabs, activeTabId } = pruneTabs(state.openTabs, state.activeTabId, new Set([orbitId]));

    set({ ...autoLayoutProject({ ...state, orbits, nodes }, projectId), openTabs, activeTabId });
  },

  deleteNode(nodeId) {
    const state = get();
    if (!state.nodes.has(nodeId)) throw new Error(`Node not found: ${nodeId}`);
    const projectId = projectIdForNode(state, nodeId);
    if (!projectId) throw new Error(`Project not found for node: ${nodeId}`);

    const nodes = new Map(state.nodes);
    nodes.delete(nodeId);

    const relationshipIds = new Set(
      [...state.relationships.values()]
        .filter((r) => r.sourceId === nodeId || r.targetId === nodeId)
        .map((r) => r.id),
    );
    const relationships = new Map(state.relationships);
    for (const id of relationshipIds) relationships.delete(id);

    const removedTabIds = new Set([nodeId, ...relationshipIds]);
    const { openTabs, activeTabId } = pruneTabs(state.openTabs, state.activeTabId, removedTabIds);

    set({
      ...autoLayoutProject({ ...state, nodes, relationships }, projectId),
      relationships,
      openTabs,
      activeTabId,
    });
  },

  deleteRelationship(relationshipId) {
    const state = get();
    const deletedRelationship = state.relationships.get(relationshipId);
    if (!deletedRelationship) {
      throw new Error(`Relationship not found: ${relationshipId}`);
    }
    const projectId = projectIdForNode(state, deletedRelationship.sourceId);
    if (!projectId) throw new Error(`Project not found for relationship: ${relationshipId}`);

    const relationships = new Map(state.relationships);
    relationships.delete(relationshipId);

    const { openTabs, activeTabId } = pruneTabs(
      state.openTabs,
      state.activeTabId,
      new Set([relationshipId]),
    );

    set({ ...autoLayoutProject({ ...state, relationships }, projectId), relationships, openTabs, activeTabId });
  },

  addNote(targetType, targetId, note) {
    const id = crypto.randomUUID();
    const fullNote: Note = {
      id,
      title: note.title,
      text: note.text,
      author: note.author,
      createdAt: Date.now(),
    };

    set(notesPatch(get(), targetType, targetId, (notes) => [...notes, fullNote]));
    return id;
  },

  updateNote(targetType, targetId, noteId, patch) {
    set(
      notesPatch(get(), targetType, targetId, (notes) =>
        notes.map((n) => (n.id === noteId ? { ...n, ...patch } : n)),
      ),
    );
  },

  deleteNote(targetType, targetId, noteId) {
    set(notesPatch(get(), targetType, targetId, (notes) => notes.filter((n) => n.id !== noteId)));
  },

  openTab(id, type) {
    const state = get();
    // Move-to-most-recent: drop any existing entry for this id, then append it, so the list
    // stays ordered oldest-to-newest and re-viewing something already in the list doesn't
    // grow it. Capping at MAX_RECENT_TABS evicts the oldest once a 6th distinct id is viewed.
    const openTabs = [...state.openTabs.filter((t) => t.id !== id), { id, type }].slice(
      -MAX_RECENT_TABS,
    );
    set({ openTabs, activeTabId: id });
  },

  setActiveTab(id) {
    const state = get();
    if (!state.openTabs.some((t) => t.id === id)) throw new Error(`Tab not open: ${id}`);
    set({ activeTabId: id });
  },

  // Closes the panel without touching openTabs — per plan.md decision #12, there's no manual
  // "close" of the recency history itself, only of which tab (if any) is currently active.
  clearActiveTab() {
    set({ activeTabId: null });
  },
})));
