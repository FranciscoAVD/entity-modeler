import { create } from "zustand";
import { subtract } from "@/lib/vector3";
import { getOrbitWorldOrigin, getWorldPosition, spacesInProject } from "./selectors";
import type {
  Cardinality,
  Entity,
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
  entities: Map<string, Entity>;
  relationships: Map<string, Relationship>;
  tags: Map<string, Tag>;

  openTabs: Tab[];
  activeTabId: string | null;
}

export interface ModelActions {
  addProject(input: { name: string; description?: string }): string;
  addSpace(input: {
    projectId: string;
    name: string;
    label?: string;
    origin?: Vector3;
    tags?: string[];
    metadata?: Record<string, string | number>;
  }): string;
  addOrbit(input: {
    spaceId: string;
    name: string;
    label?: string;
    origin?: Vector3;
    tags?: string[];
    metadata?: Record<string, string | number>;
  }): string;
  addEntity(input: {
    spaceId: string;
    orbitId?: string;
    name: string;
    tags?: string[];
    position?: Vector3;
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

  moveEntity(entityId: string, target: { spaceId: string; orbitId?: string }): void;
  updateEntityPosition(entityId: string, position: Vector3): void;
  renameSpace(spaceId: string, name: string): void;
  renameOrbit(orbitId: string, name: string): void;
  renameEntity(entityId: string, name: string): void;

  updateSpaceTags(spaceId: string, tags: string[]): void;
  updateOrbitTags(orbitId: string, tags: string[]): void;
  updateEntityTags(entityId: string, tags: string[]): void;
  updateRelationshipTags(relationshipId: string, tags: string[]): void;
  renameTag(tagId: string, name: string): void;
  deleteTag(tagId: string): void;
  updateSpaceMetadata(spaceId: string, metadata: Record<string, string | number> | undefined): void;
  updateOrbitMetadata(orbitId: string, metadata: Record<string, string | number> | undefined): void;
  updateEntityMetadata(entityId: string, metadata: Record<string, string | number> | undefined): void;
  updateRelationshipMetadata(
    relationshipId: string,
    metadata: Record<string, string | number> | undefined,
  ): void;

  deleteProject(projectId: string): void;
  deleteSpace(spaceId: string): void;
  deleteOrbit(orbitId: string): void;
  deleteEntity(entityId: string): void;
  deleteRelationship(relationshipId: string): void;

  addNote(
    targetType: NoteTargetType,
    targetId: string,
    note: { title: string; text: string; author?: string; metadata?: Record<string, string | number> },
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

// Resolves user-typed tag names (from TagEditor, or an add*'s `tags` input) against the shared
// tag registry (plan.md decision #11) — reusing an existing tag (matched case-insensitively) if
// one exists, creating it otherwise. This is the "normalize on write" step: every space/orbit/
// entity/relationship ends up referencing tags by id, so renaming a tag only ever touches the
// registry once instead of every object that carries it.
function resolveTagIds(tags: Map<string, Tag>, names: string[]): { tagIds: string[]; tags: Map<string, Tag> } {
  const nextTags = new Map(tags);
  const idByName = new Map([...tags.values()].map((t) => [t.name.toLowerCase(), t.id]));
  const tagIds: string[] = [];

  for (const rawName of names) {
    const name = rawName.trim();
    if (!name) continue;

    const key = name.toLowerCase();
    let id = idByName.get(key);
    if (!id) {
      id = crypto.randomUUID();
      nextTags.set(id, { id, name });
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
    case "entity":
      return { entities: withNotes(state.entities, targetId, updater) };
    case "relationship":
      return { relationships: withNotes(state.relationships, targetId, updater) };
  }
}

export const useModelStore = create<ModelState & ModelActions>()((set, get) => ({
  projects: new Map(),
  spaces: new Map(),
  orbits: new Map(),
  entities: new Map(),
  relationships: new Map(),
  tags: new Map(),
  openTabs: [],
  activeTabId: null,

  addProject({ name, description }) {
    const id = crypto.randomUUID();
    const projects = new Map(get().projects);
    projects.set(id, { id, name, description });
    set({ projects });
    return id;
  },

  addSpace({ projectId, name, label, origin, tags, metadata }) {
    const state = get();
    if (!state.projects.has(projectId)) throw new Error(`Project not found: ${projectId}`);

    const { tagIds, tags: nextTags } = resolveTagIds(state.tags, tags ?? []);
    const id = crypto.randomUUID();
    const spaces = new Map(state.spaces);
    spaces.set(id, {
      id,
      projectId,
      name,
      label,
      origin: origin ?? ORIGIN,
      tagIds,
      notes: [],
      metadata,
    });
    set({ spaces, tags: nextTags });
    return id;
  },

  addOrbit({ spaceId, name, label, origin, tags, metadata }) {
    const state = get();
    if (!state.spaces.has(spaceId)) throw new Error(`Space not found: ${spaceId}`);

    const { tagIds, tags: nextTags } = resolveTagIds(state.tags, tags ?? []);
    const id = crypto.randomUUID();
    const orbits = new Map(state.orbits);
    orbits.set(id, {
      id,
      spaceId,
      name,
      label,
      origin: origin ?? ORIGIN,
      tagIds,
      notes: [],
      metadata,
    });
    set({ orbits, tags: nextTags });
    return id;
  },

  addEntity({ spaceId, orbitId, name, tags, position, metadata }) {
    const state = get();
    if (!state.spaces.has(spaceId)) throw new Error(`Space not found: ${spaceId}`);
    if (orbitId !== undefined) {
      const orbit = state.orbits.get(orbitId);
      if (!orbit) throw new Error(`Orbit not found: ${orbitId}`);
      if (orbit.spaceId !== spaceId) {
        throw new Error(`Orbit ${orbitId} does not belong to space ${spaceId}`);
      }
    }

    const { tagIds, tags: nextTags } = resolveTagIds(state.tags, tags ?? []);
    const id = crypto.randomUUID();
    const entities = new Map(state.entities);
    entities.set(id, {
      id,
      spaceId,
      orbitId,
      name,
      tagIds,
      position: position ?? ORIGIN,
      notes: [],
      metadata,
    });
    set({ entities, tags: nextTags });
    return id;
  },

  addRelationship({ sourceId, targetId, cardinality, tags, metadata }) {
    if (sourceId === targetId) throw new Error("A relationship cannot connect an entity to itself");

    const state = get();
    if (!state.entities.has(sourceId)) throw new Error(`Entity not found: ${sourceId}`);
    if (!state.entities.has(targetId)) throw new Error(`Entity not found: ${targetId}`);

    const { tagIds, tags: nextTags } = resolveTagIds(state.tags, tags ?? []);
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
    set({ relationships, tags: nextTags });
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
    if (sourceId === targetId) throw new Error("A relationship cannot connect an entity to itself");

    const state = get();
    const relationship = state.relationships.get(relationshipId);
    if (!relationship) throw new Error(`Relationship not found: ${relationshipId}`);
    if (!state.entities.has(sourceId)) throw new Error(`Entity not found: ${sourceId}`);
    if (!state.entities.has(targetId)) throw new Error(`Entity not found: ${targetId}`);

    const relationships = new Map(state.relationships);
    relationships.set(relationshipId, { ...relationship, sourceId, targetId });
    set({ relationships });
  },

  moveEntity(entityId, { spaceId, orbitId }) {
    const state = get();
    const entity = state.entities.get(entityId);
    if (!entity) throw new Error(`Entity not found: ${entityId}`);
    const newSpace = state.spaces.get(spaceId);
    if (!newSpace) throw new Error(`Space not found: ${spaceId}`);
    if (orbitId !== undefined) {
      const orbit = state.orbits.get(orbitId);
      if (!orbit) throw new Error(`Orbit not found: ${orbitId}`);
      if (orbit.spaceId !== spaceId) {
        throw new Error(`Orbit ${orbitId} does not belong to space ${spaceId}`);
      }
    }

    // Re-base position so the entity's *world* position is preserved across the move — its old
    // local offset was relative to the old parent's origin, and would otherwise be silently
    // reinterpreted against the new one. Relationships reference entities by id and are never
    // touched by a move.
    const worldPosition = getWorldPosition(state, entityId);
    const newParentOrigin = orbitId !== undefined ? getOrbitWorldOrigin(state, orbitId) : newSpace.origin;
    const position = subtract(worldPosition, newParentOrigin);

    const entities = new Map(state.entities);
    entities.set(entityId, { ...entity, spaceId, orbitId, position });
    set({ entities });
  },

  updateEntityPosition(entityId, position) {
    const state = get();
    const entity = state.entities.get(entityId);
    if (!entity) throw new Error(`Entity not found: ${entityId}`);

    const entities = new Map(state.entities);
    entities.set(entityId, { ...entity, position });
    set({ entities });
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

  renameEntity(entityId, name) {
    const state = get();
    const entity = state.entities.get(entityId);
    if (!entity) throw new Error(`Entity not found: ${entityId}`);

    const entities = new Map(state.entities);
    entities.set(entityId, { ...entity, name });
    set({ entities });
  },

  updateSpaceTags(spaceId, tags) {
    const state = get();
    const space = state.spaces.get(spaceId);
    if (!space) throw new Error(`Space not found: ${spaceId}`);

    const { tagIds, tags: nextTags } = resolveTagIds(state.tags, tags);
    const spaces = new Map(state.spaces);
    spaces.set(spaceId, { ...space, tagIds });
    set({ spaces, tags: nextTags });
  },

  updateOrbitTags(orbitId, tags) {
    const state = get();
    const orbit = state.orbits.get(orbitId);
    if (!orbit) throw new Error(`Orbit not found: ${orbitId}`);

    const { tagIds, tags: nextTags } = resolveTagIds(state.tags, tags);
    const orbits = new Map(state.orbits);
    orbits.set(orbitId, { ...orbit, tagIds });
    set({ orbits, tags: nextTags });
  },

  updateEntityTags(entityId, tags) {
    const state = get();
    const entity = state.entities.get(entityId);
    if (!entity) throw new Error(`Entity not found: ${entityId}`);

    const { tagIds, tags: nextTags } = resolveTagIds(state.tags, tags);
    const entities = new Map(state.entities);
    entities.set(entityId, { ...entity, tagIds });
    set({ entities, tags: nextTags });
  },

  updateRelationshipTags(relationshipId, tags) {
    const state = get();
    const relationship = state.relationships.get(relationshipId);
    if (!relationship) throw new Error(`Relationship not found: ${relationshipId}`);

    const { tagIds, tags: nextTags } = resolveTagIds(state.tags, tags);
    const relationships = new Map(state.relationships);
    relationships.set(relationshipId, { ...relationship, tagIds });
    set({ relationships, tags: nextTags });
  },

  // Renaming only ever touches the registry — every space/orbit/entity/relationship references
  // the tag by id, so they all pick up the new name for free. This is the payoff of normalizing.
  renameTag(tagId, name) {
    const state = get();
    const tag = state.tags.get(tagId);
    if (!tag) throw new Error(`Tag not found: ${tagId}`);

    const trimmed = name.trim();
    if (!trimmed) throw new Error("Tag name cannot be empty");

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
      entities: stripTag(state.entities),
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

  updateEntityMetadata(entityId, metadata) {
    const state = get();
    const entity = state.entities.get(entityId);
    if (!entity) throw new Error(`Entity not found: ${entityId}`);

    const entities = new Map(state.entities);
    entities.set(entityId, { ...entity, metadata });
    set({ entities });
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
    set({ projects });
  },

  deleteSpace(spaceId) {
    const state = get();
    if (!state.spaces.has(spaceId)) throw new Error(`Space not found: ${spaceId}`);

    const orbitIds = new Set(
      [...state.orbits.values()].filter((o) => o.spaceId === spaceId).map((o) => o.id),
    );
    const entityIds = new Set(
      [...state.entities.values()].filter((e) => e.spaceId === spaceId).map((e) => e.id),
    );
    const relationshipIds = new Set(
      [...state.relationships.values()]
        .filter((r) => entityIds.has(r.sourceId) || entityIds.has(r.targetId))
        .map((r) => r.id),
    );

    const spaces = new Map(state.spaces);
    spaces.delete(spaceId);

    const orbits = new Map(state.orbits);
    for (const id of orbitIds) orbits.delete(id);

    const entities = new Map(state.entities);
    for (const id of entityIds) entities.delete(id);

    const relationships = new Map(state.relationships);
    for (const id of relationshipIds) relationships.delete(id);

    const removedTabIds = new Set([spaceId, ...orbitIds, ...entityIds, ...relationshipIds]);
    const { openTabs, activeTabId } = pruneTabs(state.openTabs, state.activeTabId, removedTabIds);

    set({ spaces, orbits, entities, relationships, openTabs, activeTabId });
  },

  deleteOrbit(orbitId) {
    const state = get();
    if (!state.orbits.has(orbitId)) throw new Error(`Orbit not found: ${orbitId}`);

    const orbits = new Map(state.orbits);
    orbits.delete(orbitId);

    // Entities aren't owned by their orbit (space is the required parent), so they're
    // reassigned to orbit-less rather than deleted — avoids a dangling orbitId reference.
    const entities = new Map(state.entities);
    for (const entity of state.entities.values()) {
      if (entity.orbitId === orbitId) entities.set(entity.id, { ...entity, orbitId: undefined });
    }

    const { openTabs, activeTabId } = pruneTabs(state.openTabs, state.activeTabId, new Set([orbitId]));

    set({ orbits, entities, openTabs, activeTabId });
  },

  deleteEntity(entityId) {
    const state = get();
    if (!state.entities.has(entityId)) throw new Error(`Entity not found: ${entityId}`);

    const entities = new Map(state.entities);
    entities.delete(entityId);

    const relationshipIds = new Set(
      [...state.relationships.values()]
        .filter((r) => r.sourceId === entityId || r.targetId === entityId)
        .map((r) => r.id),
    );
    const relationships = new Map(state.relationships);
    for (const id of relationshipIds) relationships.delete(id);

    const removedTabIds = new Set([entityId, ...relationshipIds]);
    const { openTabs, activeTabId } = pruneTabs(state.openTabs, state.activeTabId, removedTabIds);

    set({ entities, relationships, openTabs, activeTabId });
  },

  deleteRelationship(relationshipId) {
    const state = get();
    if (!state.relationships.has(relationshipId)) {
      throw new Error(`Relationship not found: ${relationshipId}`);
    }

    const relationships = new Map(state.relationships);
    relationships.delete(relationshipId);

    const { openTabs, activeTabId } = pruneTabs(
      state.openTabs,
      state.activeTabId,
      new Set([relationshipId]),
    );

    set({ relationships, openTabs, activeTabId });
  },

  addNote(targetType, targetId, note) {
    // Relationship notes are prose-only — no structured metadata bag (unlike Space/Orbit/Entity
    // notes), since a relationship has no natural place for the kind of structured data
    // (subnet CIDR/VLAN, etc.) that bag exists for.
    if (targetType === "relationship" && note.metadata !== undefined) {
      throw new Error("Relationship notes cannot carry metadata");
    }

    const id = crypto.randomUUID();
    const fullNote: Note = {
      id,
      title: note.title,
      text: note.text,
      author: note.author,
      createdAt: Date.now(),
      metadata: note.metadata,
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
}));
