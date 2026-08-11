import { beforeEach, describe, expect, it } from "bun:test";
import { useModelStore } from "@/store/store";
import { DEFAULT_FOCUS_TARGET, overviewDistance, resolveCameraFocus } from "./cameraFocus";

const NONE = new Set<string>();

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

describe("resolveCameraFocus", () => {
  it("defaults to the overview when no tab is active", () => {
    const { addProject } = useModelStore.getState();
    const projectId = addProject({ name: "P" });

    const focus = resolveCameraFocus(useModelStore.getState(), projectId, 0, false, null, false, NONE, NONE);
    expect(focus.target).toEqual(DEFAULT_FOCUS_TARGET);
    expect(focus.key).toBe(`reset:0:${projectId}`);
  });

  it("focuses the active node tab", () => {
    const { addProject, addSpace, addNode, openTab } = useModelStore.getState();
    const projectId = addProject({ name: "P" });
    const spaceId = addSpace({ projectId, name: "S" });
    const nodeId = addNode({ spaceId, name: "E" });
    useModelStore.setState((state) => ({
      spaces: new Map(state.spaces).set(spaceId, { ...state.spaces.get(spaceId)!, origin: { x: 10, y: 0, z: 0 } }),
      nodes: new Map(state.nodes).set(nodeId, { ...state.nodes.get(nodeId)!, position: { x: 1, y: 0, z: 0 } }),
    }));
    openTab(nodeId, "node");

    const focus = resolveCameraFocus(useModelStore.getState(), projectId, 0, false, null, false, NONE, NONE);
    expect(focus.key).toBe(`node:${nodeId}`);
    expect(focus.target).toEqual({ x: 11, y: 0, z: 0 });
  });

  it("focuses the active orbit tab, sized to its radius", () => {
    const { addProject, addSpace, addOrbit, openTab } = useModelStore.getState();
    const projectId = addProject({ name: "P" });
    const spaceId = addSpace({ projectId, name: "S" });
    const orbitId = addOrbit({ spaceId, name: "O" });
    useModelStore.setState((state) => ({
      orbits: new Map(state.orbits).set(orbitId, { ...state.orbits.get(orbitId)!, origin: { x: 2, y: 0, z: 0 } }),
    }));
    openTab(orbitId, "orbit");

    const focus = resolveCameraFocus(useModelStore.getState(), projectId, 0, false, null, false, NONE, NONE);
    expect(focus.key).toBe(`orbit:${orbitId}`);
    expect(focus.target).toEqual({ x: 2, y: 0, z: 0 });
    expect(focus.distance).toBeGreaterThan(0);
  });

  it("falls back to the overview for a stale tab id that's no longer open", () => {
    const { addProject } = useModelStore.getState();
    const projectId = addProject({ name: "P" });
    useModelStore.setState({ activeTabId: "gone" });

    const focus = resolveCameraFocus(useModelStore.getState(), projectId, 0, false, null, false, NONE, NONE);
    expect(focus.target).toEqual(DEFAULT_FOCUS_TARGET);
  });

  it("focuses the midpoint of an active relationship tab", () => {
    const { addProject, addSpace, addNode, addRelationship, openTab } = useModelStore.getState();
    const projectId = addProject({ name: "P" });
    const spaceId = addSpace({ projectId, name: "S" });
    const a = addNode({ spaceId, name: "A" });
    const b = addNode({ spaceId, name: "B" });
    const relId = addRelationship({ sourceId: a, targetId: b, direction: "one-way" });
    // Patched after creation, since addRelationship itself triggers a relayout that would
    // otherwise overwrite these — nothing runs layout again after this point.
    useModelStore.setState((state) => ({
      nodes: new Map(state.nodes)
        .set(a, { ...state.nodes.get(a)!, position: { x: 0, y: 0, z: 0 } })
        .set(b, { ...state.nodes.get(b)!, position: { x: 10, y: 0, z: 0 } }),
    }));
    openTab(relId, "relationship");

    const focus = resolveCameraFocus(useModelStore.getState(), projectId, 0, false, null, false, NONE, NONE);
    expect(focus.key).toBe(`relationship:${relId}`);
    expect(focus.target).toEqual({ x: 5, y: 0, z: 0 });
    expect(focus.distance).toBeGreaterThan(0);
  });

  // Regression: reset used to be silently overridden by whichever tab was still active.
  it("resetRequested overrides an active tab", () => {
    const { addProject, addSpace, addNode, openTab } = useModelStore.getState();
    const projectId = addProject({ name: "P" });
    const spaceId = addSpace({ projectId, name: "S" });
    const nodeId = addNode({ spaceId, name: "E" });
    openTab(nodeId, "node");

    const focus = resolveCameraFocus(useModelStore.getState(), projectId, 1, true, null, false, NONE, NONE);
    expect(focus.target).toEqual(DEFAULT_FOCUS_TARGET);
    expect(focus.key).toBe(`reset:1:${projectId}`);
  });

  it("focuses an explicit space target, sized to its radius", () => {
    const { addProject, addSpace } = useModelStore.getState();
    const projectId = addProject({ name: "P" });
    const spaceId = addSpace({ projectId, name: "S" });
    useModelStore.setState((state) => ({
      spaces: new Map(state.spaces).set(spaceId, { ...state.spaces.get(spaceId)!, origin: { x: 4, y: 0, z: 0 } }),
    }));

    const focus = resolveCameraFocus(
      useModelStore.getState(),
      projectId,
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
    const { addProject, addSpace, addNode, addOrbit, openTab } = useModelStore.getState();
    const projectId = addProject({ name: "P" });
    const spaceId = addSpace({ projectId, name: "S" });
    const nodeId = addNode({ spaceId, name: "E" });
    const orbitId = addOrbit({ spaceId, name: "O" });
    openTab(nodeId, "node");

    const focus = resolveCameraFocus(
      useModelStore.getState(),
      projectId,
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
    const { addProject, addSpace, addNode, addOrbit, openTab } = useModelStore.getState();
    const projectId = addProject({ name: "P" });
    const spaceId = addSpace({ projectId, name: "S" });
    const nodeId = addNode({ spaceId, name: "E" });
    const orbitId = addOrbit({ spaceId, name: "O" });
    openTab(nodeId, "node");

    const focus = resolveCameraFocus(
      useModelStore.getState(),
      projectId,
      0,
      false,
      { id: orbitId, type: "orbit" },
      false,
      NONE,
      NONE,
    );
    expect(focus.key).toBe(`node:${nodeId}`);
  });

  // The concrete bug: hiding an object (or clicking a hidden row/search result) must never
  // leave the camera pointed at it — there's nothing rendered there to look at.
  it("does not focus an explicit target whose space is hidden", () => {
    const { addProject, addSpace, addNode } = useModelStore.getState();
    const projectId = addProject({ name: "P" });
    const spaceId = addSpace({ projectId, name: "S" });
    const nodeId = addNode({ spaceId, name: "E" });

    const focus = resolveCameraFocus(
      useModelStore.getState(),
      projectId,
      0,
      false,
      { id: nodeId, type: "node" },
      true,
      new Set([spaceId]),
      NONE,
    );
    expect(focus.target).toEqual(DEFAULT_FOCUS_TARGET);
  });

  it("falls back to the overview when the active tab's node becomes hidden", () => {
    const { addProject, addSpace, addNode, openTab } = useModelStore.getState();
    const projectId = addProject({ name: "P" });
    const spaceId = addSpace({ projectId, name: "S" });
    const nodeId = addNode({ spaceId, name: "E" });
    openTab(nodeId, "node");

    const focus = resolveCameraFocus(
      useModelStore.getState(),
      projectId,
      0,
      false,
      null,
      false,
      new Set([spaceId]),
      NONE,
    );
    expect(focus.target).toEqual(DEFAULT_FOCUS_TARGET);
  });

  // User-requested: the overview distance should scale with how many spaces the project has,
  // within a floor and a ceiling, rather than a fixed distance regardless of project size.
  it("scales the overview distance with the project's space count", () => {
    const { addProject, addSpace } = useModelStore.getState();
    const projectId = addProject({ name: "P" });

    const empty = resolveCameraFocus(useModelStore.getState(), projectId, 0, true, null, false, NONE, NONE);
    expect(empty.distance).toBe(overviewDistance(0));

    for (let i = 0; i < 5; i++) addSpace({ projectId, name: `S${i}` });
    const withFiveSpaces = resolveCameraFocus(useModelStore.getState(), projectId, 1, true, null, false, NONE, NONE);
    expect(withFiveSpaces.distance).toBe(overviewDistance(5));
    expect(withFiveSpaces.distance).toBeGreaterThan(empty.distance);
  });

  it("clamps the overview distance between a minimum and a maximum", () => {
    const min = overviewDistance(0);
    expect(overviewDistance(1)).toBeGreaterThan(min); // not clamped yet with just one space
    const huge = overviewDistance(1000);
    expect(huge).toBe(overviewDistance(1000000)); // both hit the ceiling
    expect(huge).toBeLessThan(80); // OrbitControls' own hard maxDistance in CameraRig.tsx
  });

  // Two different projects both idle at the same resetViewToken/no-active-tab fallback must not
  // collapse to the same key — switching projects doesn't bump resetViewToken or touch
  // activeTabId, so the key has to encode projectId itself or CameraRig would skip re-tweening
  // after a switch and silently keep the previous project's camera distance.
  it("gives two different projects different overview keys even at the same reset token", () => {
    const { addProject } = useModelStore.getState();
    const projectA = addProject({ name: "A" });
    const projectB = addProject({ name: "B" });

    const focusA = resolveCameraFocus(useModelStore.getState(), projectA, 0, false, null, false, NONE, NONE);
    const focusB = resolveCameraFocus(useModelStore.getState(), projectB, 0, false, null, false, NONE, NONE);
    expect(focusA.key).not.toBe(focusB.key);
  });
});
