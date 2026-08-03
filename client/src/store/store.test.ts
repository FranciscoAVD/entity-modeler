import { beforeEach, describe, expect, it } from "bun:test";
import {
  allProjects,
  entitiesInProject,
  entitiesInSpace,
  getOrbitWorldOrigin,
  getWorldPosition,
  relationshipScope,
  relationshipsInProject,
  searchAll,
  searchByTag,
  searchByTitle,
  tabLabel,
} from "./selectors";
import { useModelStore } from "./store";

beforeEach(() => {
  useModelStore.setState({
    projects: new Map(),
    spaces: new Map(),
    orbits: new Map(),
    entities: new Map(),
    relationships: new Map(),
    openTabs: [],
    activeTabId: null,
  });
});

function seedProjectSpace() {
  const { addProject, addSpace } = useModelStore.getState();
  const projectId = addProject({ name: "Test Project" });
  const spaceId = addSpace({ projectId, name: "Space A" });
  return { projectId, spaceId };
}

describe("entity creation", () => {
  it("requires an existing space", () => {
    const { addEntity } = useModelStore.getState();
    expect(() => addEntity({ spaceId: "missing", name: "Foo" })).toThrow();
  });

  it("rejects an orbit that belongs to a different space", () => {
    const { addSpace, addOrbit, addEntity, addProject } = useModelStore.getState();
    const projectId = addProject({ name: "P" });
    const spaceA = addSpace({ projectId, name: "A" });
    const spaceB = addSpace({ projectId, name: "B" });
    const orbitInB = addOrbit({ spaceId: spaceB, name: "Orbit B" });

    expect(() => addEntity({ spaceId: spaceA, orbitId: orbitInB, name: "Foo" })).toThrow();
  });
});

describe("relationships", () => {
  it("rejects self-relationships", () => {
    const { addEntity, addRelationship } = useModelStore.getState();
    const { spaceId } = seedProjectSpace();
    const entityId = addEntity({ spaceId, name: "Solo" });

    expect(() =>
      addRelationship({ sourceId: entityId, targetId: entityId, cardinality: "1:1" }),
    ).toThrow();
  });

  it("survives the entity being moved to another space", () => {
    const { addSpace, addEntity, addRelationship, moveEntity, addProject } = useModelStore.getState();
    const projectId = addProject({ name: "P" });
    const spaceA = addSpace({ projectId, name: "A" });
    const spaceB = addSpace({ projectId, name: "B" });
    const source = addEntity({ spaceId: spaceA, name: "Source" });
    const target = addEntity({ spaceId: spaceA, name: "Target" });
    const relId = addRelationship({ sourceId: source, targetId: target, cardinality: "1:N" });

    moveEntity(source, { spaceId: spaceB });

    expect(useModelStore.getState().relationships.has(relId)).toBe(true);
    expect(useModelStore.getState().entities.get(source)?.spaceId).toBe(spaceB);
  });
});

describe("updateEntityPosition", () => {
  it("updates only the position field", () => {
    const { addEntity, updateEntityPosition } = useModelStore.getState();
    const { spaceId } = seedProjectSpace();
    const entityId = addEntity({ spaceId, name: "Node", position: { x: 0, y: 0, z: 0 } });

    updateEntityPosition(entityId, { x: 3, y: 4, z: 5 });

    const entity = useModelStore.getState().entities.get(entityId);
    expect(entity?.position).toEqual({ x: 3, y: 4, z: 5 });
    expect(entity?.spaceId).toBe(spaceId);
  });

  it("throws for an unknown entity", () => {
    const { updateEntityPosition } = useModelStore.getState();
    expect(() => updateEntityPosition("missing", { x: 0, y: 0, z: 0 })).toThrow();
  });
});

describe("cascading deletes", () => {
  it("deleting a space removes its orbits, entities, and touching relationships", () => {
    const { addSpace, addOrbit, addEntity, addRelationship, deleteSpace, addProject } =
      useModelStore.getState();
    const projectId = addProject({ name: "P" });
    const spaceA = addSpace({ projectId, name: "A" });
    const spaceB = addSpace({ projectId, name: "B" });
    const orbitId = addOrbit({ spaceId: spaceA, name: "Orbit" });
    const inA = addEntity({ spaceId: spaceA, orbitId, name: "InA" });
    const inB = addEntity({ spaceId: spaceB, name: "InB" });
    const relId = addRelationship({ sourceId: inA, targetId: inB, cardinality: "1:1" });

    deleteSpace(spaceA);

    const state = useModelStore.getState();
    expect(state.spaces.has(spaceA)).toBe(false);
    expect(state.orbits.has(orbitId)).toBe(false);
    expect(state.entities.has(inA)).toBe(false);
    expect(state.relationships.has(relId)).toBe(false);
    // Entity in the untouched space survives — only the relationship that touched a deleted entity is gone.
    expect(state.entities.has(inB)).toBe(true);
  });

  it("deleting an orbit clears orbitId on its entities instead of deleting them", () => {
    const { addOrbit, addEntity, deleteOrbit } = useModelStore.getState();
    const { spaceId } = seedProjectSpace();
    const orbitId = addOrbit({ spaceId, name: "Orbit" });
    const entityId = addEntity({ spaceId, orbitId, name: "Node" });

    deleteOrbit(orbitId);

    const state = useModelStore.getState();
    expect(state.orbits.has(orbitId)).toBe(false);
    expect(state.entities.has(entityId)).toBe(true);
    expect(state.entities.get(entityId)?.orbitId).toBeUndefined();
  });
});

describe("position resolution", () => {
  it("composes entity position with orbit and space origins", () => {
    const { addProject, addSpace, addOrbit, addEntity } = useModelStore.getState();
    const projectId = addProject({ name: "P" });
    const spaceId = addSpace({ projectId, name: "S", origin: { x: 100, y: 0, z: 0 } });
    const orbitId = addOrbit({ spaceId, name: "O", origin: { x: 0, y: 10, z: 0 } });
    const entityId = addEntity({ spaceId, orbitId, name: "E", position: { x: 1, y: 1, z: 1 } });

    const world = getWorldPosition(useModelStore.getState(), entityId);
    expect(world).toEqual({ x: 101, y: 11, z: 1 });
  });

  it("skips the orbit offset when the entity has none", () => {
    const { addProject, addSpace, addEntity } = useModelStore.getState();
    const projectId = addProject({ name: "P" });
    const spaceId = addSpace({ projectId, name: "S", origin: { x: 5, y: 0, z: 0 } });
    const entityId = addEntity({ spaceId, name: "E", position: { x: 1, y: 0, z: 0 } });

    expect(getWorldPosition(useModelStore.getState(), entityId)).toEqual({ x: 6, y: 0, z: 0 });
  });

  it("resolves an orbit's world origin from its space", () => {
    const { addProject, addSpace, addOrbit } = useModelStore.getState();
    const projectId = addProject({ name: "P" });
    const spaceId = addSpace({ projectId, name: "S", origin: { x: 10, y: 0, z: 0 } });
    const orbitId = addOrbit({ spaceId, name: "O", origin: { x: 0, y: 5, z: 0 } });

    expect(getOrbitWorldOrigin(useModelStore.getState(), orbitId)).toEqual({ x: 10, y: 5, z: 0 });
  });
});

describe("tabs", () => {
  it("opening a tab activates it without duplicating", () => {
    const { openTab } = useModelStore.getState();
    openTab("a", "entity");
    openTab("b", "entity");
    openTab("a", "entity");

    const state = useModelStore.getState();
    // Re-opening "a" moves it to the most-recent position rather than leaving it in place.
    expect(state.openTabs.map((t) => t.id)).toEqual(["b", "a"]);
    expect(state.activeTabId).toBe("a");
  });

  it("keeps only the 5 most recently viewed tabs, evicting the oldest", () => {
    const { openTab } = useModelStore.getState();
    for (const id of ["a", "b", "c", "d", "e", "f"]) openTab(id, "entity");

    const state = useModelStore.getState();
    expect(state.openTabs.map((t) => t.id)).toEqual(["b", "c", "d", "e", "f"]);
    expect(state.activeTabId).toBe("f");
  });

  it("cascading deletes prune tabs for removed entities and relationships", () => {
    const { addSpace, addEntity, addRelationship, deleteSpace, openTab, addProject } =
      useModelStore.getState();
    const projectId = addProject({ name: "P" });
    const spaceId = addSpace({ projectId, name: "S" });
    const a = addEntity({ spaceId, name: "A" });
    const b = addEntity({ spaceId, name: "B" });
    const relId = addRelationship({ sourceId: a, targetId: b, cardinality: "1:1" });
    openTab(a, "entity");
    openTab(relId, "relationship");

    deleteSpace(spaceId);

    const state = useModelStore.getState();
    expect(state.openTabs).toEqual([]);
    expect(state.activeTabId).toBeNull();
  });
});

describe("search", () => {
  it("finds objects by substring title match", () => {
    const { addProject, addSpace, addEntity } = useModelStore.getState();
    const projectId = addProject({ name: "Network Topology" });
    const spaceId = addSpace({ projectId, name: "DMZ" });
    addEntity({ spaceId, name: "Firewall" });

    const state = useModelStore.getState();
    expect(searchByTitle(state, "wall").map((r) => r.name)).toEqual(["Firewall"]);
    expect(searchByTitle(state, "dmz").map((r) => r.name)).toEqual(["DMZ"]);
  });

  it("finds spaces/orbits by tag", () => {
    const { addProject, addSpace, addOrbit } = useModelStore.getState();
    const projectId = addProject({ name: "P" });
    const spaceId = addSpace({ projectId, name: "Prod", tags: ["prod", "external-facing"] });
    addOrbit({ spaceId, name: "Edge", tags: ["prod"] });

    const state = useModelStore.getState();
    const ids = searchByTag(state, "prod");
    expect(ids).toHaveLength(2);
  });

  it("matches tags case-insensitively", () => {
    const { addProject, addSpace } = useModelStore.getState();
    const projectId = addProject({ name: "P" });
    addSpace({ projectId, name: "Prod", tags: ["Prod"] });

    expect(searchByTag(useModelStore.getState(), "PROD")).toHaveLength(1);
  });

  it("searchAll merges title and tag matches without duplicates", () => {
    const { addProject, addSpace, addEntity } = useModelStore.getState();
    const projectId = addProject({ name: "P" });
    const spaceId = addSpace({ projectId, name: "Prod Cluster", tags: ["prod"] });
    addEntity({ spaceId, name: "Server" });

    const state = useModelStore.getState();
    const byName = searchAll(state, "prod").map((r) => r.name);
    expect(byName).toEqual(["Prod Cluster"]);

    const combined = searchAll(state, "prod");
    expect(new Set(combined.map((r) => r.id)).size).toBe(combined.length);
  });
});

describe("tabLabel", () => {
  it("labels an entity tab by its name", () => {
    const { addEntity, openTab } = useModelStore.getState();
    const { spaceId } = seedProjectSpace();
    const entityId = addEntity({ spaceId, name: "Server" });
    openTab(entityId, "entity");

    const state = useModelStore.getState();
    expect(tabLabel(state, state.openTabs[0])).toBe("Server");
  });

  it("labels an orbit tab by its label, falling back to name", () => {
    const { addOrbit } = useModelStore.getState();
    const { spaceId } = seedProjectSpace();
    const orbitId = addOrbit({ spaceId, name: "orbit-1", label: "DMZ" });

    const state = useModelStore.getState();
    expect(tabLabel(state, { id: orbitId, type: "orbit" })).toBe("DMZ");
  });

  it("labels a relationship tab by its source and target entity names", () => {
    const { addEntity, addRelationship } = useModelStore.getState();
    const { spaceId } = seedProjectSpace();
    const a = addEntity({ spaceId, name: "A" });
    const b = addEntity({ spaceId, name: "B" });
    const relId = addRelationship({ sourceId: a, targetId: b, cardinality: "1:N" });

    const state = useModelStore.getState();
    expect(tabLabel(state, { id: relId, type: "relationship" })).toBe("A → B");
  });
});

describe("entitiesInSpace", () => {
  it("includes entities regardless of orbit assignment", () => {
    const { addOrbit, addEntity } = useModelStore.getState();
    const { spaceId } = seedProjectSpace();
    const orbitId = addOrbit({ spaceId, name: "O" });
    addEntity({ spaceId, orbitId, name: "InOrbit" });
    addEntity({ spaceId, name: "Ungrouped" });

    expect(entitiesInSpace(useModelStore.getState(), spaceId)).toHaveLength(2);
  });
});

describe("relationshipScope", () => {
  it("is local for two entities in the same orbit", () => {
    const { addOrbit, addEntity, addRelationship } = useModelStore.getState();
    const { spaceId } = seedProjectSpace();
    const orbitId = addOrbit({ spaceId, name: "O" });
    const a = addEntity({ spaceId, orbitId, name: "A" });
    const b = addEntity({ spaceId, orbitId, name: "B" });
    const relId = addRelationship({ sourceId: a, targetId: b, cardinality: "1:1" });

    expect(relationshipScope(useModelStore.getState(), relId)).toBe("local");
  });

  it("is local for two ungrouped entities in the same space", () => {
    const { addEntity, addRelationship } = useModelStore.getState();
    const { spaceId } = seedProjectSpace();
    const a = addEntity({ spaceId, name: "A" });
    const b = addEntity({ spaceId, name: "B" });
    const relId = addRelationship({ sourceId: a, targetId: b, cardinality: "1:1" });

    expect(relationshipScope(useModelStore.getState(), relId)).toBe("local");
  });

  it("is cross-orbit for entities in different orbits of the same space", () => {
    const { addOrbit, addEntity, addRelationship } = useModelStore.getState();
    const { spaceId } = seedProjectSpace();
    const orbitA = addOrbit({ spaceId, name: "OA" });
    const a = addEntity({ spaceId, orbitId: orbitA, name: "A" });
    const b = addEntity({ spaceId, name: "Ungrouped" });
    const relId = addRelationship({ sourceId: a, targetId: b, cardinality: "1:1" });

    expect(relationshipScope(useModelStore.getState(), relId)).toBe("cross-orbit");
  });

  it("is cross-space for entities in different spaces", () => {
    const { addSpace, addEntity, addRelationship, addProject } = useModelStore.getState();
    const projectId = addProject({ name: "P" });
    const spaceA = addSpace({ projectId, name: "A" });
    const spaceB = addSpace({ projectId, name: "B" });
    const a = addEntity({ spaceId: spaceA, name: "A" });
    const b = addEntity({ spaceId: spaceB, name: "B" });
    const relId = addRelationship({ sourceId: a, targetId: b, cardinality: "1:1" });

    expect(relationshipScope(useModelStore.getState(), relId)).toBe("cross-space");
  });
});

describe("relationshipsInProject", () => {
  it("includes relationships whose endpoints span multiple spaces in the project", () => {
    const { addSpace, addEntity, addRelationship, addProject } = useModelStore.getState();
    const projectId = addProject({ name: "P" });
    const spaceA = addSpace({ projectId, name: "A" });
    const spaceB = addSpace({ projectId, name: "B" });
    const a = addEntity({ spaceId: spaceA, name: "A" });
    const b = addEntity({ spaceId: spaceB, name: "B" });
    const relId = addRelationship({ sourceId: a, targetId: b, cardinality: "1:1" });

    const ids = relationshipsInProject(useModelStore.getState(), projectId).map((r) => r.id);
    expect(ids).toEqual([relId]);
  });

  it("excludes relationships belonging to a different project", () => {
    const { addProject, addSpace, addEntity, addRelationship } = useModelStore.getState();
    const projectA = addProject({ name: "A" });
    const projectB = addProject({ name: "B" });
    const spaceA = addSpace({ projectId: projectA, name: "SA" });
    const spaceB = addSpace({ projectId: projectB, name: "SB" });
    const a = addEntity({ spaceId: spaceA, name: "A" });
    const b = addEntity({ spaceId: spaceA, name: "B" });
    addEntity({ spaceId: spaceB, name: "Other" });
    addRelationship({ sourceId: a, targetId: b, cardinality: "1:1" });

    expect(relationshipsInProject(useModelStore.getState(), projectB)).toEqual([]);
  });
});

describe("allProjects", () => {
  it("lists every project", () => {
    const { addProject } = useModelStore.getState();
    addProject({ name: "A" });
    addProject({ name: "B" });

    expect(allProjects(useModelStore.getState()).map((p) => p.name).sort()).toEqual(["A", "B"]);
  });
});

describe("entitiesInProject", () => {
  it("includes entities across all of the project's spaces", () => {
    const { addProject, addSpace, addEntity } = useModelStore.getState();
    const projectId = addProject({ name: "P" });
    const spaceA = addSpace({ projectId, name: "A" });
    const spaceB = addSpace({ projectId, name: "B" });
    addEntity({ spaceId: spaceA, name: "A1" });
    addEntity({ spaceId: spaceB, name: "B1" });

    expect(entitiesInProject(useModelStore.getState(), projectId)).toHaveLength(2);
  });

  it("excludes entities from a different project", () => {
    const { addProject, addSpace, addEntity } = useModelStore.getState();
    const projectA = addProject({ name: "A" });
    const projectB = addProject({ name: "B" });
    const spaceA = addSpace({ projectId: projectA, name: "SA" });
    const spaceB = addSpace({ projectId: projectB, name: "SB" });
    addEntity({ spaceId: spaceA, name: "A1" });
    addEntity({ spaceId: spaceB, name: "B1" });

    expect(entitiesInProject(useModelStore.getState(), projectA)).toHaveLength(1);
  });
});
