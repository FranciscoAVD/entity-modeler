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
    entities: new Map(),
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

  it("grows to contain its farthest orbit or ungrouped entity", () => {
    const { addProject, addSpace, addOrbit, addEntity } = useModelStore.getState();
    const projectId = addProject({ name: "P" });
    const spaceId = addSpace({ projectId, name: "S" });
    addOrbit({ spaceId, name: "O", origin: { x: 10, y: 0, z: 0 } });
    addEntity({ spaceId, name: "Ungrouped", position: { x: 1, y: 1, z: 1 } });

    expect(computeSpaceRadius(useModelStore.getState(), spaceId)).toBeGreaterThan(10);
    expect(isSpaceEmpty(useModelStore.getState(), spaceId)).toBe(false);
  });

  it("is not empty when it only contains an empty orbit", () => {
    const { addProject, addSpace, addOrbit } = useModelStore.getState();
    const projectId = addProject({ name: "P" });
    const spaceId = addSpace({ projectId, name: "S" });
    addOrbit({ spaceId, name: "Empty orbit" });

    expect(isSpaceEmpty(useModelStore.getState(), spaceId)).toBe(false);
  });

  it("ignores entities that belong to an orbit when sizing the space", () => {
    const { addProject, addSpace, addOrbit, addEntity } = useModelStore.getState();
    const projectId = addProject({ name: "P" });
    const spaceId = addSpace({ projectId, name: "S" });
    const orbitId = addOrbit({ spaceId, name: "O", origin: { x: 1, y: 0, z: 0 } });
    addEntity({ spaceId, orbitId, name: "Far but in-orbit", position: { x: 100, y: 0, z: 0 } });

    expect(computeSpaceRadius(useModelStore.getState(), spaceId)).toBeLessThan(100);
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

  it("grows to contain its farthest entity", () => {
    const { addProject, addSpace, addOrbit, addEntity } = useModelStore.getState();
    const projectId = addProject({ name: "P" });
    const spaceId = addSpace({ projectId, name: "S" });
    const orbitId = addOrbit({ spaceId, name: "O" });
    addEntity({ spaceId, orbitId, name: "E", position: { x: 5, y: 0, z: 0 } });

    expect(computeOrbitRadius(useModelStore.getState(), orbitId)).toBeGreaterThan(5);
    expect(isOrbitEmpty(useModelStore.getState(), orbitId)).toBe(false);
  });
});
