import { create } from "zustand";
import { spacesInProject } from "./selectors";
import type {
  Cardinality,
  Entity,
  Field,
  Note,
  NoteTargetType,
  Orbit,
  Project,
  Relationship,
  Space,
  Tab,
  TabType,
  Vector3,
} from "./types";

const ORIGIN: Vector3 = { x: 0, y: 0, z: 0 };

export interface ModelState {
  projects: Map<string, Project>;
  spaces: Map<string, Space>;
  orbits: Map<string, Orbit>;
  entities: Map<string, Entity>;
  relationships: Map<string, Relationship>;

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
    fields?: Field[];
    position?: Vector3;
  }): string;
  addRelationship(input: { sourceId: string; targetId: string; cardinality: Cardinality }): string;

  moveEntity(entityId: string, target: { spaceId: string; orbitId?: string }): void;

  deleteProject(projectId: string): void;
  deleteSpace(spaceId: string): void;
  deleteOrbit(orbitId: string): void;
  deleteEntity(entityId: string): void;
  deleteRelationship(relationshipId: string): void;

  addNote(
    targetType: NoteTargetType,
    targetId: string,
    note: { text: string; author?: string; metadata?: Record<string, string | number> },
  ): string;

  openTab(id: string, type: TabType): void;
  closeTab(id: string): void;
  setActiveTab(id: string): void;
}

// Closing a tab (singly or via cascade delete) hands the active slot to the next
// remaining tab after it, falling back to the previous one, per plan.md's tab rules.
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

export const useModelStore = create<ModelState & ModelActions>()((set, get) => ({
  projects: new Map(),
  spaces: new Map(),
  orbits: new Map(),
  entities: new Map(),
  relationships: new Map(),
  openTabs: [],
  activeTabId: null,

  addProject({ name, description }) {
    const id = crypto.randomUUID();
    const projects = new Map(get().projects);
    projects.set(id, { id, name, description, notes: [] });
    set({ projects });
    return id;
  },

  addSpace({ projectId, name, label, origin, tags, metadata }) {
    const state = get();
    if (!state.projects.has(projectId)) throw new Error(`Project not found: ${projectId}`);

    const id = crypto.randomUUID();
    const spaces = new Map(state.spaces);
    spaces.set(id, {
      id,
      projectId,
      name,
      label,
      origin: origin ?? ORIGIN,
      tags: tags ?? [],
      notes: [],
      metadata,
    });
    set({ spaces });
    return id;
  },

  addOrbit({ spaceId, name, label, origin, tags, metadata }) {
    const state = get();
    if (!state.spaces.has(spaceId)) throw new Error(`Space not found: ${spaceId}`);

    const id = crypto.randomUUID();
    const orbits = new Map(state.orbits);
    orbits.set(id, {
      id,
      spaceId,
      name,
      label,
      origin: origin ?? ORIGIN,
      tags: tags ?? [],
      notes: [],
      metadata,
    });
    set({ orbits });
    return id;
  },

  addEntity({ spaceId, orbitId, name, fields, position }) {
    const state = get();
    if (!state.spaces.has(spaceId)) throw new Error(`Space not found: ${spaceId}`);
    if (orbitId !== undefined) {
      const orbit = state.orbits.get(orbitId);
      if (!orbit) throw new Error(`Orbit not found: ${orbitId}`);
      if (orbit.spaceId !== spaceId) {
        throw new Error(`Orbit ${orbitId} does not belong to space ${spaceId}`);
      }
    }

    const id = crypto.randomUUID();
    const entities = new Map(state.entities);
    entities.set(id, {
      id,
      spaceId,
      orbitId,
      name,
      fields: fields ?? [],
      position: position ?? ORIGIN,
      notes: [],
    });
    set({ entities });
    return id;
  },

  addRelationship({ sourceId, targetId, cardinality }) {
    if (sourceId === targetId) throw new Error("A relationship cannot connect an entity to itself");

    const state = get();
    if (!state.entities.has(sourceId)) throw new Error(`Entity not found: ${sourceId}`);
    if (!state.entities.has(targetId)) throw new Error(`Entity not found: ${targetId}`);

    const id = crypto.randomUUID();
    const relationships = new Map(state.relationships);
    relationships.set(id, { id, sourceId, targetId, cardinality, notes: [] });
    set({ relationships });
    return id;
  },

  moveEntity(entityId, { spaceId, orbitId }) {
    const state = get();
    const entity = state.entities.get(entityId);
    if (!entity) throw new Error(`Entity not found: ${entityId}`);
    if (!state.spaces.has(spaceId)) throw new Error(`Space not found: ${spaceId}`);
    if (orbitId !== undefined) {
      const orbit = state.orbits.get(orbitId);
      if (!orbit) throw new Error(`Orbit not found: ${orbitId}`);
      if (orbit.spaceId !== spaceId) {
        throw new Error(`Orbit ${orbitId} does not belong to space ${spaceId}`);
      }
    }

    // Field update only — relationships reference entities by id and are never touched by a move.
    const entities = new Map(state.entities);
    entities.set(entityId, { ...entity, spaceId, orbitId });
    set({ entities });
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

    const removedTabIds = new Set([...orbitIds, ...entityIds, ...relationshipIds]);
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
    const state = get();
    const id = crypto.randomUUID();
    const fullNote: Note = { id, text: note.text, author: note.author, createdAt: Date.now(), metadata: note.metadata };

    switch (targetType) {
      case "project": {
        const project = state.projects.get(targetId);
        if (!project) throw new Error(`Project not found: ${targetId}`);
        const projects = new Map(state.projects);
        projects.set(targetId, { ...project, notes: [...project.notes, fullNote] });
        set({ projects });
        break;
      }
      case "space": {
        const space = state.spaces.get(targetId);
        if (!space) throw new Error(`Space not found: ${targetId}`);
        const spaces = new Map(state.spaces);
        spaces.set(targetId, { ...space, notes: [...space.notes, fullNote] });
        set({ spaces });
        break;
      }
      case "orbit": {
        const orbit = state.orbits.get(targetId);
        if (!orbit) throw new Error(`Orbit not found: ${targetId}`);
        const orbits = new Map(state.orbits);
        orbits.set(targetId, { ...orbit, notes: [...orbit.notes, fullNote] });
        set({ orbits });
        break;
      }
      case "entity": {
        const entity = state.entities.get(targetId);
        if (!entity) throw new Error(`Entity not found: ${targetId}`);
        const entities = new Map(state.entities);
        entities.set(targetId, { ...entity, notes: [...entity.notes, fullNote] });
        set({ entities });
        break;
      }
      case "relationship": {
        const relationship = state.relationships.get(targetId);
        if (!relationship) throw new Error(`Relationship not found: ${targetId}`);
        const relationships = new Map(state.relationships);
        relationships.set(targetId, { ...relationship, notes: [...relationship.notes, fullNote] });
        set({ relationships });
        break;
      }
    }

    return id;
  },

  openTab(id, type) {
    const state = get();
    const exists = state.openTabs.some((t) => t.id === id);
    const openTabs = exists ? state.openTabs : [...state.openTabs, { id, type }];
    set({ openTabs, activeTabId: id });
  },

  closeTab(id) {
    const state = get();
    const { openTabs, activeTabId } = pruneTabs(state.openTabs, state.activeTabId, new Set([id]));
    set({ openTabs, activeTabId });
  },

  setActiveTab(id) {
    const state = get();
    if (!state.openTabs.some((t) => t.id === id)) throw new Error(`Tab not open: ${id}`);
    set({ activeTabId: id });
  },
}));
