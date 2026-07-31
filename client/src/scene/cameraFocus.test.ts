import { beforeEach, describe, expect, it } from "bun:test";
import { useModelStore } from "@/store/store";
import { DEFAULT_FOCUS_TARGET, resolveCameraFocus } from "./cameraFocus";

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

describe("resolveCameraFocus", () => {
  it("defaults to the overview when no tab is active", () => {
    const focus = resolveCameraFocus(useModelStore.getState(), 0, false);
    expect(focus.target).toEqual(DEFAULT_FOCUS_TARGET);
    expect(focus.key).toBe("reset:0");
  });

  it("focuses the active entity tab", () => {
    const { addProject, addSpace, addEntity, openTab } = useModelStore.getState();
    const projectId = addProject({ name: "P" });
    const spaceId = addSpace({ projectId, name: "S", origin: { x: 10, y: 0, z: 0 } });
    const entityId = addEntity({ spaceId, name: "E", position: { x: 1, y: 0, z: 0 } });
    openTab(entityId, "entity");

    const focus = resolveCameraFocus(useModelStore.getState(), 0, false);
    expect(focus.key).toBe(`entity:${entityId}`);
    expect(focus.target).toEqual({ x: 11, y: 0, z: 0 });
  });

  it("focuses the active orbit tab, sized to its radius", () => {
    const { addProject, addSpace, addOrbit, openTab } = useModelStore.getState();
    const projectId = addProject({ name: "P" });
    const spaceId = addSpace({ projectId, name: "S" });
    const orbitId = addOrbit({ spaceId, name: "O", origin: { x: 2, y: 0, z: 0 } });
    openTab(orbitId, "orbit");

    const focus = resolveCameraFocus(useModelStore.getState(), 0, false);
    expect(focus.key).toBe(`orbit:${orbitId}`);
    expect(focus.target).toEqual({ x: 2, y: 0, z: 0 });
    expect(focus.distance).toBeGreaterThan(0);
  });

  it("falls back to the overview for a stale tab id that's no longer open", () => {
    useModelStore.setState({ activeTabId: "gone" });
    const focus = resolveCameraFocus(useModelStore.getState(), 0, false);
    expect(focus.target).toEqual(DEFAULT_FOCUS_TARGET);
  });

  it("focuses the midpoint of an active relationship tab", () => {
    const { addProject, addSpace, addEntity, addRelationship, openTab } = useModelStore.getState();
    const projectId = addProject({ name: "P" });
    const spaceId = addSpace({ projectId, name: "S" });
    const a = addEntity({ spaceId, name: "A", position: { x: 0, y: 0, z: 0 } });
    const b = addEntity({ spaceId, name: "B", position: { x: 10, y: 0, z: 0 } });
    const relId = addRelationship({ sourceId: a, targetId: b, cardinality: "1:N" });
    openTab(relId, "relationship");

    const focus = resolveCameraFocus(useModelStore.getState(), 0, false);
    expect(focus.key).toBe(`relationship:${relId}`);
    expect(focus.target).toEqual({ x: 5, y: 0, z: 0 });
    expect(focus.distance).toBeGreaterThan(0);
  });

  // Regression: reset used to be silently overridden by whichever tab was still active.
  it("resetRequested overrides an active tab", () => {
    const { addProject, addSpace, addEntity, openTab } = useModelStore.getState();
    const projectId = addProject({ name: "P" });
    const spaceId = addSpace({ projectId, name: "S" });
    const entityId = addEntity({ spaceId, name: "E" });
    openTab(entityId, "entity");

    const focus = resolveCameraFocus(useModelStore.getState(), 1, true);
    expect(focus.target).toEqual(DEFAULT_FOCUS_TARGET);
    expect(focus.key).toBe("reset:1");
  });
});
