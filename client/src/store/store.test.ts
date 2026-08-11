import { beforeEach, describe, expect, it } from "bun:test";
import {
  allProjects,
  nodesInProject,
  nodesInSpace,
  nodeDeleteImpact,
  getOrbitWorldOrigin,
  getWorldPosition,
  objectsForTag,
  relationshipScope,
  relationshipsInProject,
  searchAll,
  searchByTitle,
  searchTags,
  spaceDeleteImpact,
  tabLabel,
  tagsInProject,
} from "./selectors";
import { useModelStore } from "./store";

beforeEach(() => {
  useModelStore.setState({
    projects: new Map(),
    spaces: new Map(),
    orbits: new Map(),
    nodes: new Map(),
    relationships: new Map(),
    tags: new Map(),
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

describe("node creation", () => {
  it("requires an existing space", () => {
    const { addNode } = useModelStore.getState();
    expect(() => addNode({ spaceId: "missing", name: "Foo" })).toThrow();
  });

  it("rejects an orbit that belongs to a different space", () => {
    const { addSpace, addOrbit, addNode, addProject } = useModelStore.getState();
    const projectId = addProject({ name: "P" });
    const spaceA = addSpace({ projectId, name: "A" });
    const spaceB = addSpace({ projectId, name: "B" });
    const orbitInB = addOrbit({ spaceId: spaceB, name: "Orbit B" });

    expect(() => addNode({ spaceId: spaceA, orbitId: orbitInB, name: "Foo" })).toThrow();
  });
});

describe("relationships", () => {
  it("rejects self-relationships", () => {
    const { addNode, addRelationship } = useModelStore.getState();
    const { spaceId } = seedProjectSpace();
    const nodeId = addNode({ spaceId, name: "Solo" });

    expect(() =>
      addRelationship({ sourceId: nodeId, targetId: nodeId, direction: "one-way" }),
    ).toThrow();
  });

  it("survives the node being moved to another space", () => {
    const { addSpace, addNode, addRelationship, moveNode, addProject } = useModelStore.getState();
    const projectId = addProject({ name: "P" });
    const spaceA = addSpace({ projectId, name: "A" });
    const spaceB = addSpace({ projectId, name: "B" });
    const source = addNode({ spaceId: spaceA, name: "Source" });
    const target = addNode({ spaceId: spaceA, name: "Target" });
    const relId = addRelationship({ sourceId: source, targetId: target, direction: "one-way" });

    moveNode(source, { spaceId: spaceB });

    expect(useModelStore.getState().relationships.has(relId)).toBe(true);
    expect(useModelStore.getState().nodes.get(source)?.spaceId).toBe(spaceB);
  });
});

describe("updateRelationshipDirection", () => {
  it("replaces the direction without touching sourceId/targetId/notes", () => {
    const { addNode, addRelationship, updateRelationshipDirection } = useModelStore.getState();
    const { spaceId } = seedProjectSpace();
    const source = addNode({ spaceId, name: "Source" });
    const target = addNode({ spaceId, name: "Target" });
    const relId = addRelationship({ sourceId: source, targetId: target, direction: "one-way" });

    updateRelationshipDirection(relId, "two-way");

    const relationship = useModelStore.getState().relationships.get(relId);
    expect(relationship?.direction).toBe("two-way");
    expect(relationship?.sourceId).toBe(source);
    expect(relationship?.targetId).toBe(target);
  });

  it("throws for a missing relationship", () => {
    const { updateRelationshipDirection } = useModelStore.getState();
    expect(() => updateRelationshipDirection("missing", "two-way")).toThrow();
  });
});

describe("updateRelationshipEndpoints", () => {
  it("re-points the relationship at a new source/target pair", () => {
    const { addNode, addRelationship, updateRelationshipEndpoints } = useModelStore.getState();
    const { spaceId } = seedProjectSpace();
    const a = addNode({ spaceId, name: "A" });
    const b = addNode({ spaceId, name: "B" });
    const c = addNode({ spaceId, name: "C" });
    const relId = addRelationship({ sourceId: a, targetId: b, direction: "one-way" });

    updateRelationshipEndpoints(relId, { sourceId: a, targetId: c });

    const relationship = useModelStore.getState().relationships.get(relId);
    expect(relationship?.sourceId).toBe(a);
    expect(relationship?.targetId).toBe(c);
  });

  it("rejects making source and target the same node", () => {
    const { addNode, addRelationship, updateRelationshipEndpoints } = useModelStore.getState();
    const { spaceId } = seedProjectSpace();
    const a = addNode({ spaceId, name: "A" });
    const b = addNode({ spaceId, name: "B" });
    const relId = addRelationship({ sourceId: a, targetId: b, direction: "one-way" });

    expect(() => updateRelationshipEndpoints(relId, { sourceId: a, targetId: a })).toThrow();
  });

  it("throws for a missing relationship or node", () => {
    const { addNode, addRelationship, updateRelationshipEndpoints } = useModelStore.getState();
    const { spaceId } = seedProjectSpace();
    const a = addNode({ spaceId, name: "A" });
    const b = addNode({ spaceId, name: "B" });
    const relId = addRelationship({ sourceId: a, targetId: b, direction: "one-way" });

    expect(() =>
      updateRelationshipEndpoints("missing", { sourceId: a, targetId: b }),
    ).toThrow();
    expect(() =>
      updateRelationshipEndpoints(relId, { sourceId: a, targetId: "missing" }),
    ).toThrow();
  });
});

// Position/origin are entirely auto-layout's responsibility now (plan.md Phase 7) — moveNode's
// own job is just re-parenting (reassigning spaceId/orbitId, with the same validation every other
// action already has); world-position preservation across a move is gone, since auto-layout
// recomputes every position in the target project from scratch right after. Layout-algorithm
// behavior itself (does a moved node end up somewhere reasonable, does the graph reconverge) is
// autoLayout.test.ts's job, not this file's.
describe("moveNode", () => {
  it("reassigns spaceId, dropping orbitId when none is given", () => {
    const { addProject, addSpace, addOrbit, addNode, moveNode } = useModelStore.getState();
    const projectId = addProject({ name: "P" });
    const spaceA = addSpace({ projectId, name: "A" });
    const spaceB = addSpace({ projectId, name: "B" });
    const orbitId = addOrbit({ spaceId: spaceA, name: "O" });
    const nodeId = addNode({ spaceId: spaceA, orbitId, name: "E" });

    moveNode(nodeId, { spaceId: spaceB });

    const node = useModelStore.getState().nodes.get(nodeId);
    expect(node?.spaceId).toBe(spaceB);
    expect(node?.orbitId).toBeUndefined();
  });

  it("reassigns spaceId and orbitId together", () => {
    const { addProject, addSpace, addOrbit, addNode, moveNode } = useModelStore.getState();
    const projectId = addProject({ name: "P" });
    const spaceId = addSpace({ projectId, name: "S" });
    const orbitId = addOrbit({ spaceId, name: "O" });
    const nodeId = addNode({ spaceId, name: "E" });

    moveNode(nodeId, { spaceId, orbitId });

    expect(useModelStore.getState().nodes.get(nodeId)?.orbitId).toBe(orbitId);
  });

  it("throws if the target orbit doesn't belong to the target space", () => {
    const { addProject, addSpace, addOrbit, addNode, moveNode } = useModelStore.getState();
    const projectId = addProject({ name: "P" });
    const spaceA = addSpace({ projectId, name: "A" });
    const spaceB = addSpace({ projectId, name: "B" });
    const orbitInA = addOrbit({ spaceId: spaceA, name: "O" });
    const nodeId = addNode({ spaceId: spaceA, name: "E" });

    expect(() => moveNode(nodeId, { spaceId: spaceB, orbitId: orbitInA })).toThrow();
  });
});

describe("tags and metadata", () => {
  it("updateNodeTags replaces the tags array without touching other fields", () => {
    const { addNode, updateNodeTags } = useModelStore.getState();
    const { spaceId } = seedProjectSpace();
    const nodeId = addNode({ spaceId, name: "Node", tags: ["a"] });

    updateNodeTags(nodeId, ["b", "c"]);

    const state = useModelStore.getState();
    const node = state.nodes.get(nodeId);
    expect(node?.tagIds.map((id) => state.tags.get(id)?.name)).toEqual(["b", "c"]);
    expect(node?.name).toBe("Node");
  });

  it("updateOrbitTags and updateSpaceTags update their respective records", () => {
    const { addOrbit, updateOrbitTags, updateSpaceTags } = useModelStore.getState();
    const { spaceId } = seedProjectSpace();
    const orbitId = addOrbit({ spaceId, name: "Orbit" });

    updateSpaceTags(spaceId, ["prod"]);
    updateOrbitTags(orbitId, ["core"]);

    const state = useModelStore.getState();
    expect(state.spaces.get(spaceId)?.tagIds.map((id) => state.tags.get(id)?.name)).toEqual([
      "prod",
    ]);
    expect(state.orbits.get(orbitId)?.tagIds.map((id) => state.tags.get(id)?.name)).toEqual([
      "core",
    ]);
  });

  it("reuses an existing tag (case-insensitively) instead of creating a duplicate", () => {
    const { addNode, updateNodeTags } = useModelStore.getState();
    const { spaceId } = seedProjectSpace();
    const a = addNode({ spaceId, name: "A", tags: ["Billing"] });
    const b = addNode({ spaceId, name: "B", tags: ["billing"] });

    const state = useModelStore.getState();
    const aTagId = state.nodes.get(a)?.tagIds[0];
    const bTagId = state.nodes.get(b)?.tagIds[0];
    expect(aTagId).toBe(bTagId);
    expect(state.tags.size).toBe(1);

    updateNodeTags(a, ["Billing", "billing"]);
    expect(useModelStore.getState().nodes.get(a)?.tagIds).toHaveLength(1);
  });

  it("renameTag updates the shared name for every object referencing it", () => {
    const { addNode, addSpace, renameTag, addProject } = useModelStore.getState();
    const projectId = addProject({ name: "P" });
    const spaceId = addSpace({ projectId, name: "Space", tags: ["core"] });
    const nodeId = addNode({ spaceId, name: "Node", tags: ["core"] });

    const tagId = useModelStore.getState().spaces.get(spaceId)?.tagIds[0]!;
    renameTag(tagId, "critical");

    const state = useModelStore.getState();
    expect(state.tags.get(tagId)?.name).toBe("critical");
    expect(state.spaces.get(spaceId)?.tagIds).toContain(tagId);
    expect(state.nodes.get(nodeId)?.tagIds).toContain(tagId);
  });

  it("renameTag throws for an unknown tag or an empty name", () => {
    const { addNode, renameTag } = useModelStore.getState();
    const { spaceId } = seedProjectSpace();
    const nodeId = addNode({ spaceId, name: "Node", tags: ["core"] });
    const tagId = useModelStore.getState().nodes.get(nodeId)?.tagIds[0]!;

    expect(() => renameTag("missing", "x")).toThrow();
    expect(() => renameTag(tagId, "  ")).toThrow();
  });

  it("deleteTag removes it from the registry and every object that referenced it", () => {
    const { addNode, addSpace, deleteTag, addProject } = useModelStore.getState();
    const projectId = addProject({ name: "P" });
    const spaceId = addSpace({ projectId, name: "Space", tags: ["core"] });
    const nodeId = addNode({ spaceId, name: "Node", tags: ["core", "other"] });

    const tagId = useModelStore.getState().spaces.get(spaceId)?.tagIds[0]!;
    deleteTag(tagId);

    const state = useModelStore.getState();
    expect(state.tags.has(tagId)).toBe(false);
    expect(state.spaces.get(spaceId)?.tagIds).toEqual([]);
    expect(state.nodes.get(nodeId)?.tagIds).toHaveLength(1);
  });

  it("deleteTag throws for an unknown tag", () => {
    const { deleteTag } = useModelStore.getState();
    expect(() => deleteTag("missing")).toThrow();
  });

  it("scopes tag identity to a project — the same name in two projects resolves to two tags", () => {
    const { addProject, addSpace } = useModelStore.getState();
    const projectA = addProject({ name: "A" });
    const projectB = addProject({ name: "B" });
    const spaceA = addSpace({ projectId: projectA, name: "Space A", tags: ["billing"] });
    const spaceB = addSpace({ projectId: projectB, name: "Space B", tags: ["billing"] });

    const state = useModelStore.getState();
    const tagIdA = state.spaces.get(spaceA)?.tagIds[0];
    const tagIdB = state.spaces.get(spaceB)?.tagIds[0];
    expect(tagIdA).toBeDefined();
    expect(tagIdB).toBeDefined();
    expect(tagIdA).not.toBe(tagIdB);
    expect(state.tags.size).toBe(2);
  });

  it("renameTag throws when the new name collides with another tag in the same project", () => {
    const { addProject, addSpace, renameTag } = useModelStore.getState();
    const projectId = addProject({ name: "P" });
    const spaceId = addSpace({ projectId, name: "Space", tags: ["core", "edge"] });

    const [coreId] = useModelStore.getState().spaces.get(spaceId)!.tagIds;
    expect(() => renameTag(coreId, "edge")).toThrow();
  });

  it("renameTag allows the same name already used by a tag in a different project", () => {
    const { addProject, addSpace, renameTag } = useModelStore.getState();
    const projectA = addProject({ name: "A" });
    const projectB = addProject({ name: "B" });
    addSpace({ projectId: projectB, name: "Space B", tags: ["edge"] });
    const spaceA = addSpace({ projectId: projectA, name: "Space A", tags: ["core"] });

    const [coreId] = useModelStore.getState().spaces.get(spaceA)!.tagIds;
    expect(() => renameTag(coreId, "edge")).not.toThrow();
    expect(useModelStore.getState().tags.get(coreId)?.name).toBe("edge");
  });

  it("deleteProject removes only that project's tags from the registry", () => {
    const { addProject, addSpace, deleteProject } = useModelStore.getState();
    const projectA = addProject({ name: "A" });
    const projectB = addProject({ name: "B" });
    addSpace({ projectId: projectA, name: "Space A", tags: ["billing"] });
    const spaceB = addSpace({ projectId: projectB, name: "Space B", tags: ["billing"] });

    const tagIdB = useModelStore.getState().spaces.get(spaceB)!.tagIds[0];
    deleteProject(projectA);

    const state = useModelStore.getState();
    expect([...state.tags.values()].every((t) => t.projectId === projectB)).toBe(true);
    expect(state.tags.has(tagIdB)).toBe(true);
  });

  it("updateNodeMetadata sets and clears the metadata bag", () => {
    const { addNode, updateNodeMetadata } = useModelStore.getState();
    const { spaceId } = seedProjectSpace();
    const nodeId = addNode({ spaceId, name: "Node" });

    updateNodeMetadata(nodeId, { version: "1.0" });
    expect(useModelStore.getState().nodes.get(nodeId)?.metadata).toEqual({ version: "1.0" });

    updateNodeMetadata(nodeId, undefined);
    expect(useModelStore.getState().nodes.get(nodeId)?.metadata).toBeUndefined();
  });

  it("updateOrbitMetadata and updateSpaceMetadata update their respective records", () => {
    const { addOrbit, updateOrbitMetadata, updateSpaceMetadata } = useModelStore.getState();
    const { spaceId } = seedProjectSpace();
    const orbitId = addOrbit({ spaceId, name: "Orbit" });

    updateSpaceMetadata(spaceId, { region: "us-east-1" });
    updateOrbitMetadata(orbitId, { owner: "platform" });

    expect(useModelStore.getState().spaces.get(spaceId)?.metadata).toEqual({ region: "us-east-1" });
    expect(useModelStore.getState().orbits.get(orbitId)?.metadata).toEqual({ owner: "platform" });
  });

  it("throws for an unknown target", () => {
    const { updateNodeTags, updateOrbitMetadata } = useModelStore.getState();
    expect(() => updateNodeTags("missing", ["x"])).toThrow();
    expect(() => updateOrbitMetadata("missing", { a: 1 })).toThrow();
  });

  it("addRelationship accepts tags/metadata, and updateRelationshipTags/Metadata replace them", () => {
    const { addNode, addRelationship, updateRelationshipTags, updateRelationshipMetadata } =
      useModelStore.getState();
    const { spaceId } = seedProjectSpace();
    const a = addNode({ spaceId, name: "A" });
    const b = addNode({ spaceId, name: "B" });
    const relId = addRelationship({
      sourceId: a,
      targetId: b,
      direction: "one-way",
      tags: ["vpn"],
      metadata: { vlan: 12 },
    });

    const afterCreate = useModelStore.getState();
    const createdTagId = afterCreate.relationships.get(relId)?.tagIds[0];
    expect(createdTagId && afterCreate.tags.get(createdTagId)?.name).toBe("vpn");
    expect(afterCreate.relationships.get(relId)?.metadata).toEqual({ vlan: 12 });

    updateRelationshipTags(relId, ["vpn", "cross-space"]);
    updateRelationshipMetadata(relId, undefined);

    const state = useModelStore.getState();
    const relationship = state.relationships.get(relId);
    expect(relationship?.tagIds.map((id) => state.tags.get(id)?.name)).toEqual([
      "vpn",
      "cross-space",
    ]);
    expect(relationship?.metadata).toBeUndefined();
  });

  it("updateRelationshipTags/Metadata throw for an unknown relationship", () => {
    const { updateRelationshipTags, updateRelationshipMetadata } = useModelStore.getState();
    expect(() => updateRelationshipTags("missing", ["x"])).toThrow();
    expect(() => updateRelationshipMetadata("missing", { a: 1 })).toThrow();
  });
});

describe("notes", () => {
  it("addNote, updateNote, and deleteNote round-trip on a node", () => {
    const { addNode, addNote, updateNote, deleteNote } = useModelStore.getState();
    const { spaceId } = seedProjectSpace();
    const nodeId = addNode({ spaceId, name: "Node" });

    const noteId = addNote("node", nodeId, { title: "Original", text: "First draft" });
    expect(useModelStore.getState().nodes.get(nodeId)?.notes).toHaveLength(1);

    updateNote("node", nodeId, noteId, { title: "Updated", text: "Second draft" });
    const updated = useModelStore.getState().nodes.get(nodeId)?.notes[0];
    expect(updated).toMatchObject({ title: "Updated", text: "Second draft" });

    deleteNote("node", nodeId, noteId);
    expect(useModelStore.getState().nodes.get(nodeId)?.notes).toHaveLength(0);
  });

  it("works on a relationship target too", () => {
    const { addNode, addRelationship, addNote, updateNote, deleteNote } = useModelStore.getState();
    const { spaceId } = seedProjectSpace();
    const a = addNode({ spaceId, name: "A" });
    const b = addNode({ spaceId, name: "B" });
    const relId = addRelationship({ sourceId: a, targetId: b, direction: "one-way" });

    const noteId = addNote("relationship", relId, { title: "Path", text: "Direct" });
    updateNote("relationship", relId, noteId, { title: "Path", text: "Via VPN" });
    expect(useModelStore.getState().relationships.get(relId)?.notes[0]?.text).toBe("Via VPN");

    deleteNote("relationship", relId, noteId);
    expect(useModelStore.getState().relationships.get(relId)?.notes).toHaveLength(0);
  });

  it("throws for an unknown target", () => {
    const { addNote } = useModelStore.getState();
    expect(() => addNote("node", "missing", { title: "T", text: "X" })).toThrow();
  });
});

describe("cascading deletes", () => {
  it("deleting a space removes its orbits, nodes, and touching relationships", () => {
    const { addSpace, addOrbit, addNode, addRelationship, deleteSpace, addProject } =
      useModelStore.getState();
    const projectId = addProject({ name: "P" });
    const spaceA = addSpace({ projectId, name: "A" });
    const spaceB = addSpace({ projectId, name: "B" });
    const orbitId = addOrbit({ spaceId: spaceA, name: "Orbit" });
    const inA = addNode({ spaceId: spaceA, orbitId, name: "InA" });
    const inB = addNode({ spaceId: spaceB, name: "InB" });
    const relId = addRelationship({ sourceId: inA, targetId: inB, direction: "one-way" });

    deleteSpace(spaceA);

    const state = useModelStore.getState();
    expect(state.spaces.has(spaceA)).toBe(false);
    expect(state.orbits.has(orbitId)).toBe(false);
    expect(state.nodes.has(inA)).toBe(false);
    expect(state.relationships.has(relId)).toBe(false);
    // Node in the untouched space survives — only the relationship that touched a deleted node is gone.
    expect(state.nodes.has(inB)).toBe(true);
  });

  it("deleting an orbit clears orbitId on its nodes instead of deleting them", () => {
    const { addOrbit, addNode, deleteOrbit } = useModelStore.getState();
    const { spaceId } = seedProjectSpace();
    const orbitId = addOrbit({ spaceId, name: "Orbit" });
    const nodeId = addNode({ spaceId, orbitId, name: "Node" });

    deleteOrbit(orbitId);

    const state = useModelStore.getState();
    expect(state.orbits.has(orbitId)).toBe(false);
    expect(state.nodes.has(nodeId)).toBe(true);
    expect(state.nodes.get(nodeId)?.orbitId).toBeUndefined();
  });
});

describe("delete-impact selectors", () => {
  it("spaceDeleteImpact counts orbits, nodes, and relationships touching the space", () => {
    const { addSpace, addOrbit, addNode, addRelationship, addProject } = useModelStore.getState();
    const projectId = addProject({ name: "P" });
    const spaceA = addSpace({ projectId, name: "A" });
    const spaceB = addSpace({ projectId, name: "B" });
    const orbitId = addOrbit({ spaceId: spaceA, name: "Orbit" });
    const inA = addNode({ spaceId: spaceA, orbitId, name: "InA" });
    const ungroupedInA = addNode({ spaceId: spaceA, name: "UngroupedInA" });
    const inB = addNode({ spaceId: spaceB, name: "InB" });
    addRelationship({ sourceId: inA, targetId: ungroupedInA, direction: "one-way" }); // local to A
    addRelationship({ sourceId: ungroupedInA, targetId: inB, direction: "one-way" }); // touches A

    const impact = spaceDeleteImpact(useModelStore.getState(), spaceA);

    expect(impact).toEqual({ orbits: 1, nodes: 2, relationships: 2 });
  });

  it("nodeDeleteImpact counts relationships touching the node", () => {
    const { addNode, addRelationship } = useModelStore.getState();
    const { spaceId } = seedProjectSpace();
    const a = addNode({ spaceId, name: "A" });
    const b = addNode({ spaceId, name: "B" });
    const c = addNode({ spaceId, name: "C" });
    addRelationship({ sourceId: a, targetId: b, direction: "one-way" });
    addRelationship({ sourceId: c, targetId: a, direction: "one-way" });
    addRelationship({ sourceId: b, targetId: c, direction: "two-way" }); // doesn't touch a

    expect(nodeDeleteImpact(useModelStore.getState(), a)).toEqual({ relationships: 2 });
  });
});

// getWorldPosition/getOrbitWorldOrigin are pure resolution math (walk node.position -> orbit.origin
// -> space.origin) independent of *how* those fields got set — auto-layout owns them in the real
// app, but that's irrelevant here. Positions are patched directly via setState (bypassing the
// add* actions' now-automatic relayout) so each test gets exact, known coordinates to resolve.
describe("position resolution", () => {
  it("composes node position with orbit and space origins", () => {
    const { addProject, addSpace, addOrbit, addNode } = useModelStore.getState();
    const projectId = addProject({ name: "P" });
    const spaceId = addSpace({ projectId, name: "S" });
    const orbitId = addOrbit({ spaceId, name: "O" });
    const nodeId = addNode({ spaceId, orbitId, name: "E" });

    useModelStore.setState((state) => ({
      spaces: new Map(state.spaces).set(spaceId, { ...state.spaces.get(spaceId)!, origin: { x: 100, y: 0, z: 0 } }),
      orbits: new Map(state.orbits).set(orbitId, { ...state.orbits.get(orbitId)!, origin: { x: 0, y: 10, z: 0 } }),
      nodes: new Map(state.nodes).set(nodeId, { ...state.nodes.get(nodeId)!, position: { x: 1, y: 1, z: 1 } }),
    }));

    const world = getWorldPosition(useModelStore.getState(), nodeId);
    expect(world).toEqual({ x: 101, y: 11, z: 1 });
  });

  it("skips the orbit offset when the node has none", () => {
    const { addProject, addSpace, addNode } = useModelStore.getState();
    const projectId = addProject({ name: "P" });
    const spaceId = addSpace({ projectId, name: "S" });
    const nodeId = addNode({ spaceId, name: "E" });

    useModelStore.setState((state) => ({
      spaces: new Map(state.spaces).set(spaceId, { ...state.spaces.get(spaceId)!, origin: { x: 5, y: 0, z: 0 } }),
      nodes: new Map(state.nodes).set(nodeId, { ...state.nodes.get(nodeId)!, position: { x: 1, y: 0, z: 0 } }),
    }));

    expect(getWorldPosition(useModelStore.getState(), nodeId)).toEqual({ x: 6, y: 0, z: 0 });
  });

  it("resolves an orbit's world origin from its space", () => {
    const { addProject, addSpace, addOrbit } = useModelStore.getState();
    const projectId = addProject({ name: "P" });
    const spaceId = addSpace({ projectId, name: "S" });
    const orbitId = addOrbit({ spaceId, name: "O" });

    useModelStore.setState((state) => ({
      spaces: new Map(state.spaces).set(spaceId, { ...state.spaces.get(spaceId)!, origin: { x: 10, y: 0, z: 0 } }),
      orbits: new Map(state.orbits).set(orbitId, { ...state.orbits.get(orbitId)!, origin: { x: 0, y: 5, z: 0 } }),
    }));

    expect(getOrbitWorldOrigin(useModelStore.getState(), orbitId)).toEqual({ x: 10, y: 5, z: 0 });
  });
});

describe("tabs", () => {
  it("opening a tab activates it without duplicating", () => {
    const { openTab } = useModelStore.getState();
    openTab("a", "node");
    openTab("b", "node");
    openTab("a", "node");

    const state = useModelStore.getState();
    // Re-opening "a" moves it to the most-recent position rather than leaving it in place.
    expect(state.openTabs.map((t) => t.id)).toEqual(["b", "a"]);
    expect(state.activeTabId).toBe("a");
  });

  it("keeps only the 5 most recently viewed tabs, evicting the oldest", () => {
    const { openTab } = useModelStore.getState();
    for (const id of ["a", "b", "c", "d", "e", "f"]) openTab(id, "node");

    const state = useModelStore.getState();
    expect(state.openTabs.map((t) => t.id)).toEqual(["b", "c", "d", "e", "f"]);
    expect(state.activeTabId).toBe("f");
  });

  it("cascading deletes prune tabs for removed nodes and relationships", () => {
    const { addSpace, addNode, addRelationship, deleteSpace, openTab, addProject } =
      useModelStore.getState();
    const projectId = addProject({ name: "P" });
    const spaceId = addSpace({ projectId, name: "S" });
    const a = addNode({ spaceId, name: "A" });
    const b = addNode({ spaceId, name: "B" });
    const relId = addRelationship({ sourceId: a, targetId: b, direction: "one-way" });
    openTab(a, "node");
    openTab(relId, "relationship");

    deleteSpace(spaceId);

    const state = useModelStore.getState();
    expect(state.openTabs).toEqual([]);
    expect(state.activeTabId).toBeNull();
  });

  it("clearActiveTab deactivates without touching openTabs", () => {
    const { openTab, clearActiveTab } = useModelStore.getState();
    openTab("a", "node");
    openTab("b", "node");

    clearActiveTab();

    const state = useModelStore.getState();
    expect(state.activeTabId).toBeNull();
    expect(state.openTabs.map((t) => t.id)).toEqual(["a", "b"]);
  });
});

describe("search", () => {
  it("finds objects by substring title match", () => {
    const { addProject, addSpace, addNode } = useModelStore.getState();
    const projectId = addProject({ name: "Network Topology" });
    const spaceId = addSpace({ projectId, name: "DMZ" });
    addNode({ spaceId, name: "Firewall" });

    const state = useModelStore.getState();
    expect(searchByTitle(state, "wall", projectId).map((r) => r.name)).toEqual(["Firewall"]);
    expect(searchByTitle(state, "dmz", projectId).map((r) => r.name)).toEqual(["DMZ"]);
  });

  it("searchTags fuzzy-matches tag names, deduped across objects that share a tag", () => {
    const { addProject, addSpace, addOrbit } = useModelStore.getState();
    const projectId = addProject({ name: "P" });
    const spaceId = addSpace({ projectId, name: "Prod", tags: ["prod", "external-facing"] });
    addOrbit({ spaceId, name: "Edge", tags: ["prod"] });

    const state = useModelStore.getState();
    // "prod" is shared (case-insensitive dedup, decision #11) between the space and the orbit —
    // one registry entry, so one tag result, not two.
    expect(searchTags(state, "prod", projectId).map((r) => r.name)).toEqual(["prod"]);
    expect(searchTags(state, "facing", projectId).map((r) => r.name)).toEqual(["external-facing"]);
  });

  it("matches tags case-insensitively", () => {
    const { addProject, addSpace } = useModelStore.getState();
    const projectId = addProject({ name: "P" });
    addSpace({ projectId, name: "Prod", tags: ["Prod"] });

    expect(searchTags(useModelStore.getState(), "PROD", projectId)).toHaveLength(1);
  });

  it("searchAll puts tag matches before title matches, as distinct results", () => {
    const { addProject, addSpace, addNode } = useModelStore.getState();
    const projectId = addProject({ name: "P" });
    const spaceId = addSpace({ projectId, name: "Prod Cluster", tags: ["prod"] });
    addNode({ spaceId, name: "Server" });

    const state = useModelStore.getState();
    const combined = searchAll(state, "prod", projectId);
    // A tag named "prod" and a space named "Prod Cluster" are two separate categories now — the
    // tag no longer resolves directly to the objects carrying it (that's objectsForTag's job,
    // surfaced via a click-through dialog instead of being merged into this list).
    expect(combined.map((r) => ({ type: r.type, name: r.name }))).toEqual([
      { type: "tag", name: "prod" },
      { type: "space", name: "Prod Cluster" },
    ]);
  });

  it("does not match objects or tags from a different project", () => {
    const { addProject, addSpace } = useModelStore.getState();
    const projectA = addProject({ name: "A" });
    const projectB = addProject({ name: "B" });
    addSpace({ projectId: projectA, name: "Prod Cluster", tags: ["prod"] });
    addSpace({ projectId: projectB, name: "Prod Backup", tags: ["prod"] });

    const state = useModelStore.getState();
    expect(searchAll(state, "prod", projectA).map((r) => r.name)).toEqual(["prod", "Prod Cluster"]);
    expect(searchAll(state, "prod", projectB).map((r) => r.name)).toEqual(["prod", "Prod Backup"]);
  });

  it("does not include projects in search results", () => {
    const { addProject } = useModelStore.getState();
    const projectId = addProject({ name: "Network Topology" });

    const state = useModelStore.getState();
    expect(searchAll(state, "network", projectId)).toEqual([]);
  });
});

describe("tag registry selectors", () => {
  it("tagsInProject lists only a project's own tags, sorted by name", () => {
    const { addProject, addSpace } = useModelStore.getState();
    const projectA = addProject({ name: "A" });
    const projectB = addProject({ name: "B" });
    addSpace({ projectId: projectA, name: "Space A", tags: ["zeta", "alpha"] });
    addSpace({ projectId: projectB, name: "Space B", tags: ["billing"] });

    const names = tagsInProject(useModelStore.getState(), projectA).map((t) => t.name);
    expect(names).toEqual(["alpha", "zeta"]);
  });

  it("objectsForTag resolves every space/orbit/node carrying a tag", () => {
    const { addProject, addSpace, addOrbit, addNode } = useModelStore.getState();
    const projectId = addProject({ name: "P" });
    const spaceId = addSpace({ projectId, name: "Prod", tags: ["prod"] });
    addOrbit({ spaceId, name: "Edge", tags: ["prod"] });
    addNode({ spaceId, name: "Server", tags: ["prod"] });
    addNode({ spaceId, name: "Untagged" });

    const state = useModelStore.getState();
    const tagId = state.spaces.get(spaceId)!.tagIds[0];
    const results = objectsForTag(state, tagId);
    expect(results.map((r) => r.name).sort()).toEqual(["Edge", "Prod", "Server"]);
  });

  it("objectsForTag also resolves relationships, labeled by their endpoints", () => {
    const { addProject, addSpace, addNode, addRelationship } = useModelStore.getState();
    const projectId = addProject({ name: "P" });
    const spaceId = addSpace({ projectId, name: "Space" });
    const a = addNode({ spaceId, name: "A" });
    const b = addNode({ spaceId, name: "B" });
    const relId = addRelationship({ sourceId: a, targetId: b, direction: "one-way", tags: ["vpn"] });

    const state = useModelStore.getState();
    const tagId = state.relationships.get(relId)!.tagIds[0];
    const results = objectsForTag(state, tagId);
    expect(results).toEqual([{ id: relId, type: "relationship", name: "A → B" }]);
  });
});

describe("tabLabel", () => {
  it("labels a node tab by its name", () => {
    const { addNode, openTab } = useModelStore.getState();
    const { spaceId } = seedProjectSpace();
    const nodeId = addNode({ spaceId, name: "Server" });
    openTab(nodeId, "node");

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

  it("labels a relationship tab by its source and target node names", () => {
    const { addNode, addRelationship } = useModelStore.getState();
    const { spaceId } = seedProjectSpace();
    const a = addNode({ spaceId, name: "A" });
    const b = addNode({ spaceId, name: "B" });
    const relId = addRelationship({ sourceId: a, targetId: b, direction: "one-way" });

    const state = useModelStore.getState();
    expect(tabLabel(state, { id: relId, type: "relationship" })).toBe("A → B");
  });
});

describe("nodesInSpace", () => {
  it("includes nodes regardless of orbit assignment", () => {
    const { addOrbit, addNode } = useModelStore.getState();
    const { spaceId } = seedProjectSpace();
    const orbitId = addOrbit({ spaceId, name: "O" });
    addNode({ spaceId, orbitId, name: "InOrbit" });
    addNode({ spaceId, name: "Ungrouped" });

    expect(nodesInSpace(useModelStore.getState(), spaceId)).toHaveLength(2);
  });
});

describe("relationshipScope", () => {
  it("is local for two nodes in the same orbit", () => {
    const { addOrbit, addNode, addRelationship } = useModelStore.getState();
    const { spaceId } = seedProjectSpace();
    const orbitId = addOrbit({ spaceId, name: "O" });
    const a = addNode({ spaceId, orbitId, name: "A" });
    const b = addNode({ spaceId, orbitId, name: "B" });
    const relId = addRelationship({ sourceId: a, targetId: b, direction: "one-way" });

    expect(relationshipScope(useModelStore.getState(), relId)).toBe("local");
  });

  it("is local for two ungrouped nodes in the same space", () => {
    const { addNode, addRelationship } = useModelStore.getState();
    const { spaceId } = seedProjectSpace();
    const a = addNode({ spaceId, name: "A" });
    const b = addNode({ spaceId, name: "B" });
    const relId = addRelationship({ sourceId: a, targetId: b, direction: "one-way" });

    expect(relationshipScope(useModelStore.getState(), relId)).toBe("local");
  });

  it("is cross-orbit for nodes in different orbits of the same space", () => {
    const { addOrbit, addNode, addRelationship } = useModelStore.getState();
    const { spaceId } = seedProjectSpace();
    const orbitA = addOrbit({ spaceId, name: "OA" });
    const a = addNode({ spaceId, orbitId: orbitA, name: "A" });
    const b = addNode({ spaceId, name: "Ungrouped" });
    const relId = addRelationship({ sourceId: a, targetId: b, direction: "one-way" });

    expect(relationshipScope(useModelStore.getState(), relId)).toBe("cross-orbit");
  });

  it("is cross-space for nodes in different spaces", () => {
    const { addSpace, addNode, addRelationship, addProject } = useModelStore.getState();
    const projectId = addProject({ name: "P" });
    const spaceA = addSpace({ projectId, name: "A" });
    const spaceB = addSpace({ projectId, name: "B" });
    const a = addNode({ spaceId: spaceA, name: "A" });
    const b = addNode({ spaceId: spaceB, name: "B" });
    const relId = addRelationship({ sourceId: a, targetId: b, direction: "one-way" });

    expect(relationshipScope(useModelStore.getState(), relId)).toBe("cross-space");
  });
});

describe("relationshipsInProject", () => {
  it("includes relationships whose endpoints span multiple spaces in the project", () => {
    const { addSpace, addNode, addRelationship, addProject } = useModelStore.getState();
    const projectId = addProject({ name: "P" });
    const spaceA = addSpace({ projectId, name: "A" });
    const spaceB = addSpace({ projectId, name: "B" });
    const a = addNode({ spaceId: spaceA, name: "A" });
    const b = addNode({ spaceId: spaceB, name: "B" });
    const relId = addRelationship({ sourceId: a, targetId: b, direction: "one-way" });

    const ids = relationshipsInProject(useModelStore.getState(), projectId).map((r) => r.id);
    expect(ids).toEqual([relId]);
  });

  it("excludes relationships belonging to a different project", () => {
    const { addProject, addSpace, addNode, addRelationship } = useModelStore.getState();
    const projectA = addProject({ name: "A" });
    const projectB = addProject({ name: "B" });
    const spaceA = addSpace({ projectId: projectA, name: "SA" });
    const spaceB = addSpace({ projectId: projectB, name: "SB" });
    const a = addNode({ spaceId: spaceA, name: "A" });
    const b = addNode({ spaceId: spaceA, name: "B" });
    addNode({ spaceId: spaceB, name: "Other" });
    addRelationship({ sourceId: a, targetId: b, direction: "one-way" });

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

describe("nodesInProject", () => {
  it("includes nodes across all of the project's spaces", () => {
    const { addProject, addSpace, addNode } = useModelStore.getState();
    const projectId = addProject({ name: "P" });
    const spaceA = addSpace({ projectId, name: "A" });
    const spaceB = addSpace({ projectId, name: "B" });
    addNode({ spaceId: spaceA, name: "A1" });
    addNode({ spaceId: spaceB, name: "B1" });

    expect(nodesInProject(useModelStore.getState(), projectId)).toHaveLength(2);
  });

  it("excludes nodes from a different project", () => {
    const { addProject, addSpace, addNode } = useModelStore.getState();
    const projectA = addProject({ name: "A" });
    const projectB = addProject({ name: "B" });
    const spaceA = addSpace({ projectId: projectA, name: "SA" });
    const spaceB = addSpace({ projectId: projectB, name: "SB" });
    addNode({ spaceId: spaceA, name: "A1" });
    addNode({ spaceId: spaceB, name: "B1" });

    expect(nodesInProject(useModelStore.getState(), projectA)).toHaveLength(1);
  });
});
