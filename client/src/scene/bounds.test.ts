import { beforeEach, describe, expect, it } from "bun:test";
import { useModelStore } from "@/store/store";
import {
  computeOrbitRadius,
  computeSpaceRadius,
  isOrbitEmpty,
  isSpaceEmpty,
  MIN_BOUNDARY_RADIUS,
} from "./bounds";

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

describe("space radius and emptiness", () => {
  it("floors an empty space at the minimum radius", () => {
    const { addProject, addSpace } = useModelStore.getState();
    const projectId = addProject({ name: "P" });
    const spaceId = addSpace({ projectId, name: "S" });

    expect(computeSpaceRadius(useModelStore.getState(), spaceId)).toBe(MIN_BOUNDARY_RADIUS);
    expect(isSpaceEmpty(useModelStore.getState(), spaceId)).toBe(true);
  });

  it("grows as more orbits/ungrouped nodes are added, regardless of their position", () => {
    const { addProject, addSpace, addOrbit, addNode } = useModelStore.getState();
    const projectId = addProject({ name: "P" });
    const spaceId = addSpace({ projectId, name: "S" });
    const before = computeSpaceRadius(useModelStore.getState(), spaceId);

    // Far-flung origin/position must not matter — only presence does.
    addOrbit({ spaceId, name: "O", origin: { x: 500, y: 0, z: 0 } });
    addNode({ spaceId, name: "Ungrouped", position: { x: -500, y: 0, z: 0 } });

    expect(computeSpaceRadius(useModelStore.getState(), spaceId)).toBeGreaterThan(before);
    expect(isSpaceEmpty(useModelStore.getState(), spaceId)).toBe(false);
  });

  it("is not empty when it only contains an empty orbit", () => {
    const { addProject, addSpace, addOrbit } = useModelStore.getState();
    const projectId = addProject({ name: "P" });
    const spaceId = addSpace({ projectId, name: "S" });
    addOrbit({ spaceId, name: "Empty orbit" });

    expect(isSpaceEmpty(useModelStore.getState(), spaceId)).toBe(false);
  });

  it("ignores nodes that belong to an orbit when sizing the space", () => {
    const { addProject, addSpace, addOrbit, addNode } = useModelStore.getState();
    const projectId = addProject({ name: "P" });
    const spaceId = addSpace({ projectId, name: "S" });
    const orbitId = addOrbit({ spaceId, name: "O" });
    const withOrbitOnly = computeSpaceRadius(useModelStore.getState(), spaceId);

    addNode({ spaceId, orbitId, name: "In orbit" });

    // Adding a node INSIDE the orbit doesn't add another ungrouped-node weight to the space.
    expect(computeSpaceRadius(useModelStore.getState(), spaceId)).toBeGreaterThan(withOrbitOnly);
    addNode({ spaceId, name: "Ungrouped" });
    const withOrbitAndUngrouped = computeSpaceRadius(useModelStore.getState(), spaceId);
    expect(withOrbitAndUngrouped).toBeGreaterThan(withOrbitOnly);
  });

  it("grows enough to fit a heavily-populated orbit", () => {
    const { addProject, addSpace, addOrbit, addNode } = useModelStore.getState();
    const projectId = addProject({ name: "P" });
    const spaceId = addSpace({ projectId, name: "S" });
    const orbitId = addOrbit({ spaceId, name: "O" });

    for (let i = 0; i < 20; i++) addNode({ spaceId, orbitId, name: `E${i}` });

    const spaceRadius = computeSpaceRadius(useModelStore.getState(), spaceId);
    const orbitRadius = computeOrbitRadius(useModelStore.getState(), orbitId);
    expect(spaceRadius).toBeGreaterThan(orbitRadius);
  });
});

describe("orbit radius and emptiness", () => {
  it("floors an empty orbit at the minimum radius", () => {
    const { addProject, addSpace, addOrbit } = useModelStore.getState();
    const projectId = addProject({ name: "P" });
    const spaceId = addSpace({ projectId, name: "S" });
    const orbitId = addOrbit({ spaceId, name: "O" });

    expect(computeOrbitRadius(useModelStore.getState(), orbitId)).toBe(MIN_BOUNDARY_RADIUS);
    expect(isOrbitEmpty(useModelStore.getState(), orbitId)).toBe(true);
  });

  it("grows as more nodes are added, regardless of their position", () => {
    const { addProject, addSpace, addOrbit, addNode } = useModelStore.getState();
    const projectId = addProject({ name: "P" });
    const spaceId = addSpace({ projectId, name: "S" });
    const orbitId = addOrbit({ spaceId, name: "O" });
    const before = computeOrbitRadius(useModelStore.getState(), orbitId);

    addNode({ spaceId, orbitId, name: "E", position: { x: 500, y: 0, z: 0 } });

    expect(computeOrbitRadius(useModelStore.getState(), orbitId)).toBeGreaterThan(before);
    expect(isOrbitEmpty(useModelStore.getState(), orbitId)).toBe(false);
  });

  it("is unaffected by moving a node within the orbit", () => {
    const { addProject, addSpace, addOrbit, addNode, updateNodePosition } =
      useModelStore.getState();
    const projectId = addProject({ name: "P" });
    const spaceId = addSpace({ projectId, name: "S" });
    const orbitId = addOrbit({ spaceId, name: "O" });
    const nodeId = addNode({ spaceId, orbitId, name: "E" });
    const before = computeOrbitRadius(useModelStore.getState(), orbitId);

    updateNodePosition(nodeId, { x: 1000, y: 1000, z: 1000 });

    expect(computeOrbitRadius(useModelStore.getState(), orbitId)).toBe(before);
  });
});
