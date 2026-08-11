import { beforeEach, describe, expect, it } from "bun:test";
import { useModelStore } from "@/store/store";
import { isRelationshipVisible } from "./edgeVisibility";

beforeEach(() => {
  useModelStore.setState({
    projects: new Map(),
    spaces: new Map(),
    orbits: new Map(),
    nodes: new Map(),
    relationships: new Map(),
    openTabs: [],
    activeTabId: null,
  });
});

function seedRelationship(orbitId?: string) {
  const { addProject, addSpace, addOrbit, addNode, addRelationship } = useModelStore.getState();
  const projectId = addProject({ name: "P" });
  const spaceId = addSpace({ projectId, name: "S" });
  const resolvedOrbitId = orbitId ?? addOrbit({ spaceId, name: "O" });
  const a = addNode({ spaceId, orbitId: resolvedOrbitId, name: "A" });
  const b = addNode({ spaceId, orbitId: resolvedOrbitId, name: "B" });
  const relId = addRelationship({ sourceId: a, targetId: b, cardinality: "1:1" });
  return { spaceId, orbitId: resolvedOrbitId, relId };
}

describe("isRelationshipVisible", () => {
  it("is visible when nothing is hidden", () => {
    const { relId } = seedRelationship();
    expect(isRelationshipVisible(useModelStore.getState(), relId, new Set(), new Set())).toBe(true);
  });

  it("is hidden when its space is hidden", () => {
    const { spaceId, relId } = seedRelationship();
    expect(
      isRelationshipVisible(useModelStore.getState(), relId, new Set([spaceId]), new Set()),
    ).toBe(false);
  });

  it("is hidden when its orbit is hidden", () => {
    const { orbitId, relId } = seedRelationship();
    expect(
      isRelationshipVisible(useModelStore.getState(), relId, new Set(), new Set([orbitId])),
    ).toBe(false);
  });

  it("stays visible when an unrelated orbit is hidden", () => {
    const { relId } = seedRelationship();
    expect(
      isRelationshipVisible(useModelStore.getState(), relId, new Set(), new Set(["other-orbit"])),
    ).toBe(true);
  });

  it("is hidden if only one endpoint's orbit is hidden", () => {
    const { addProject, addSpace, addOrbit, addNode, addRelationship } = useModelStore.getState();
    const projectId = addProject({ name: "P" });
    const spaceId = addSpace({ projectId, name: "S" });
    const orbitA = addOrbit({ spaceId, name: "OA" });
    const a = addNode({ spaceId, orbitId: orbitA, name: "A" });
    const b = addNode({ spaceId, name: "Ungrouped" });
    const relId = addRelationship({ sourceId: a, targetId: b, cardinality: "1:1" });

    expect(
      isRelationshipVisible(useModelStore.getState(), relId, new Set(), new Set([orbitA])),
    ).toBe(false);
  });
});
