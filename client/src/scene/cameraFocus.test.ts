import { beforeEach, describe, expect, it } from "bun:test";
import { useModelStore } from "@/store/store";
import { DEFAULT_FOCUS_TARGET, resolveCameraFocus } from "./cameraFocus";

const NONE = new Set<string>();

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
    const focus = resolveCameraFocus(useModelStore.getState(), 0, false, null, false, NONE, NONE);
    expect(focus.target).toEqual(DEFAULT_FOCUS_TARGET);
    expect(focus.key).toBe("reset:0");
  });

  it("focuses the active entity tab", () => {
    const { addProject, addSpace, addEntity, openTab } = useModelStore.getState();
    const projectId = addProject({ name: "P" });
    const spaceId = addSpace({ projectId, name: "S", origin: { x: 10, y: 0, z: 0 } });
    const entityId = addEntity({ spaceId, name: "E", position: { x: 1, y: 0, z: 0 } });
    openTab(entityId, "entity");

    const focus = resolveCameraFocus(useModelStore.getState(), 0, false, null, false, NONE, NONE);
    expect(focus.key).toBe(`entity:${entityId}`);
    expect(focus.target).toEqual({ x: 11, y: 0, z: 0 });
  });

  it("focuses the active orbit tab, sized to its radius", () => {
    const { addProject, addSpace, addOrbit, openTab } = useModelStore.getState();
    const projectId = addProject({ name: "P" });
    const spaceId = addSpace({ projectId, name: "S" });
    const orbitId = addOrbit({ spaceId, name: "O", origin: { x: 2, y: 0, z: 0 } });
    openTab(orbitId, "orbit");

    const focus = resolveCameraFocus(useModelStore.getState(), 0, false, null, false, NONE, NONE);
    expect(focus.key).toBe(`orbit:${orbitId}`);
    expect(focus.target).toEqual({ x: 2, y: 0, z: 0 });
    expect(focus.distance).toBeGreaterThan(0);
  });

  it("falls back to the overview for a stale tab id that's no longer open", () => {
    useModelStore.setState({ activeTabId: "gone" });
    const focus = resolveCameraFocus(useModelStore.getState(), 0, false, null, false, NONE, NONE);
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

    const focus = resolveCameraFocus(useModelStore.getState(), 0, false, null, false, NONE, NONE);
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

    const focus = resolveCameraFocus(useModelStore.getState(), 1, true, null, false, NONE, NONE);
    expect(focus.target).toEqual(DEFAULT_FOCUS_TARGET);
    expect(focus.key).toBe("reset:1");
  });

  it("focuses an explicit space target, sized to its radius", () => {
    const { addProject, addSpace } = useModelStore.getState();
    const projectId = addProject({ name: "P" });
    const spaceId = addSpace({ projectId, name: "S", origin: { x: 4, y: 0, z: 0 } });

    const focus = resolveCameraFocus(
      useModelStore.getState(),
      0,
      false,
      { id: spaceId, type: "space" },
      true,
      NONE,
      NONE,
    );
    expect(focus.key).toBe(`space:${spaceId}`);
    expect(focus.target).toEqual({ x: 4, y: 0, z: 0 });
    expect(focus.distance).toBeGreaterThan(0);
  });

  // Sidebar clicks (focusOn) must move the camera without disturbing whichever tab/panel is
  // already open — an explicit focus request wins over the active tab.
  it("an explicit focus request overrides an active tab", () => {
    const { addProject, addSpace, addEntity, addOrbit, openTab } = useModelStore.getState();
    const projectId = addProject({ name: "P" });
    const spaceId = addSpace({ projectId, name: "S" });
    const entityId = addEntity({ spaceId, name: "E" });
    const orbitId = addOrbit({ spaceId, name: "O" });
    openTab(entityId, "entity");

    const focus = resolveCameraFocus(
      useModelStore.getState(),
      0,
      false,
      { id: orbitId, type: "orbit" },
      true,
      NONE,
      NONE,
    );
    expect(focus.key).toBe(`orbit:${orbitId}`);
  });

  // focusRequested is only true in the render right after focusOn fires — a stale focusTarget
  // left over from a prior click must not keep overriding the active tab on every re-render.
  it("falls back to the active tab when focusTarget is stale (not freshly requested)", () => {
    const { addProject, addSpace, addEntity, addOrbit, openTab } = useModelStore.getState();
    const projectId = addProject({ name: "P" });
    const spaceId = addSpace({ projectId, name: "S" });
    const entityId = addEntity({ spaceId, name: "E" });
    const orbitId = addOrbit({ spaceId, name: "O" });
    openTab(entityId, "entity");

    const focus = resolveCameraFocus(
      useModelStore.getState(),
      0,
      false,
      { id: orbitId, type: "orbit" },
      false,
      NONE,
      NONE,
    );
    expect(focus.key).toBe(`entity:${entityId}`);
  });

  // The concrete bug: hiding an object (or clicking a hidden row/search result) must never
  // leave the camera pointed at it — there's nothing rendered there to look at.
  it("does not focus an explicit target whose space is hidden", () => {
    const { addProject, addSpace, addEntity } = useModelStore.getState();
    const projectId = addProject({ name: "P" });
    const spaceId = addSpace({ projectId, name: "S" });
    const entityId = addEntity({ spaceId, name: "E" });

    const focus = resolveCameraFocus(
      useModelStore.getState(),
      0,
      false,
      { id: entityId, type: "entity" },
      true,
      new Set([spaceId]),
      NONE,
    );
    expect(focus.target).toEqual(DEFAULT_FOCUS_TARGET);
  });

  it("falls back to the overview when the active tab's entity becomes hidden", () => {
    const { addProject, addSpace, addEntity, openTab } = useModelStore.getState();
    const projectId = addProject({ name: "P" });
    const spaceId = addSpace({ projectId, name: "S" });
    const entityId = addEntity({ spaceId, name: "E" });
    openTab(entityId, "entity");

    const focus = resolveCameraFocus(
      useModelStore.getState(),
      0,
      false,
      null,
      false,
      new Set([spaceId]),
      NONE,
    );
    expect(focus.target).toEqual(DEFAULT_FOCUS_TARGET);
  });
});
