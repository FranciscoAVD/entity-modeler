import { length, midpoint, subtract } from "@/lib/vector3";
import { getOrbitWorldOrigin, getWorldPosition, spacesInProject } from "@/store/selectors";
import type { ModelState } from "@/store/store";
import type { Vector3 } from "@/store/types";
import { computeOrbitRadius, computeSpaceRadius } from "./bounds";
import { isRelationshipVisible } from "./edgeVisibility";
import type { FocusTarget } from "./viewStore";
import { isNodeVisible, isOrbitVisible, isSpaceVisible } from "./visibility";

export const DEFAULT_FOCUS_TARGET: Vector3 = { x: 0, y: 0, z: 0 };
export const DEFAULT_CAMERA_POSITION: Vector3 = { x: 18, y: 14, z: 22 };

const NODE_FOCUS_DISTANCE = 6;
const ORBIT_FOCUS_MARGIN = 3;
const ORBIT_FOCUS_RADIUS_FACTOR = 2.2;
const SPACE_FOCUS_MARGIN = 4;
const SPACE_FOCUS_RADIUS_FACTOR = 1.6;
const RELATIONSHIP_FOCUS_MIN_DISTANCE = 8;
const RELATIONSHIP_FOCUS_DISTANCE_FACTOR = 1.1;

// The overview ("reset view", or the fallback when nothing else is focused) scales with how many
// spaces the project has — more spaces means more to fit in view, so the camera needs to sit
// further back; bounded so a huge project doesn't push it absurdly far out (OrbitControls' own
// hard cap in CameraRig.tsx is 80) and a tiny one doesn't sit unnaturally close. MIN alone (at 0-1
// spaces) matches the old fixed distance this replaces almost exactly, so the common case doesn't
// visibly change.
const OVERVIEW_DISTANCE_MIN = 20;
const OVERVIEW_DISTANCE_MAX = 70;
const OVERVIEW_DISTANCE_PER_SPACE = 6;

export function overviewDistance(spaceCount: number): number {
  const raw = OVERVIEW_DISTANCE_MIN + spaceCount * OVERVIEW_DISTANCE_PER_SPACE;
  return Math.min(OVERVIEW_DISTANCE_MAX, Math.max(OVERVIEW_DISTANCE_MIN, raw));
}

export interface CameraFocus {
  key: string;
  target: Vector3;
  distance: number;
}

// projectId is part of the key, not just an input to the distance — switching projects doesn't
// bump resetViewToken or touch activeTabId (tabs aren't project-scoped), so without this, two
// projects that happen to land on the same resetViewToken/no-active-tab fallback would produce
// identical keys and CameraRig's `focus.key === focusKeyRef.current` check would skip re-tweening
// entirely, silently leaving the camera at the previous project's distance after a switch.
function defaultFocus(resetViewToken: number, projectId: string, spaceCount: number): CameraFocus {
  return {
    key: `reset:${resetViewToken}:${projectId}`,
    target: DEFAULT_FOCUS_TARGET,
    distance: overviewDistance(spaceCount),
  };
}

// Each of these is shared by the sidebar/scene-click explicit-focus branch and the matching
// tab branch below — both need the identical key/target/distance once the object is confirmed
// to exist and be visible.
function spaceFocus(state: ModelState, spaceId: string): CameraFocus {
  return {
    key: `space:${spaceId}`,
    target: state.spaces.get(spaceId)!.origin,
    distance: computeSpaceRadius(state, spaceId) * SPACE_FOCUS_RADIUS_FACTOR + SPACE_FOCUS_MARGIN,
  };
}

function orbitFocus(state: ModelState, orbitId: string): CameraFocus {
  return {
    key: `orbit:${orbitId}`,
    target: getOrbitWorldOrigin(state, orbitId),
    distance: computeOrbitRadius(state, orbitId) * ORBIT_FOCUS_RADIUS_FACTOR + ORBIT_FOCUS_MARGIN,
  };
}

function nodeFocus(state: ModelState, nodeId: string): CameraFocus {
  return {
    key: `node:${nodeId}`,
    target: getWorldPosition(state, nodeId),
    distance: NODE_FOCUS_DISTANCE,
  };
}

function relationshipFocus(state: ModelState, relationshipId: string): CameraFocus {
  const relationship = state.relationships.get(relationshipId)!;
  const sourcePos = getWorldPosition(state, relationship.sourceId);
  const targetPos = getWorldPosition(state, relationship.targetId);
  const edgeLength = length(subtract(targetPos, sourcePos));
  return {
    key: `relationship:${relationshipId}`,
    target: midpoint(sourcePos, targetPos),
    distance: Math.max(RELATIONSHIP_FOCUS_MIN_DISTANCE, edgeLength * RELATIONSHIP_FOCUS_DISTANCE_FACTOR),
  };
}

// Resolves an explicit focus request (space/orbit/node/relationship) — from a sidebar row or
// a single click on an object in the 3D scene — independent of tabs. Reuses the same key format
// as the tab-based branches below so refocusing an object that's also the active tab is a no-op
// rather than a redundant re-tween. A hidden target resolves to null (falls through to the
// tab/default branches) — there's nothing rendered to fly to, so focusing it would just point
// the camera at empty space.
function resolveExplicitFocus(
  state: ModelState,
  target: FocusTarget,
  hiddenSpaceIds: ReadonlySet<string>,
  hiddenOrbitIds: ReadonlySet<string>,
): CameraFocus | null {
  if (target.type === "space" && state.spaces.has(target.id) && isSpaceVisible(hiddenSpaceIds, target.id)) {
    return spaceFocus(state, target.id);
  }

  if (target.type === "orbit" && isOrbitVisible(state, target.id, hiddenSpaceIds, hiddenOrbitIds)) {
    return orbitFocus(state, target.id);
  }

  if (target.type === "node" && isNodeVisible(state, target.id, hiddenSpaceIds, hiddenOrbitIds)) {
    return nodeFocus(state, target.id);
  }

  if (
    target.type === "relationship" &&
    state.relationships.has(target.id) &&
    isRelationshipVisible(state, target.id, hiddenSpaceIds, hiddenOrbitIds)
  ) {
    return relationshipFocus(state, target.id);
  }

  return null;
}

// A reset request must win even while a tab is still active — otherwise the tab-focus
// branch below would keep re-selecting itself and "Reset view" would silently no-op.
// `resetRequested`/`focusRequested` are computed by the caller (CameraRig diffs each token
// against its previous value) since detecting "just changed" isn't something a pure function
// can do from a snapshot alone. An explicit focus request wins over the active tab so a
// sidebar click can move the camera without disturbing whichever tab/panel is already open.
//
// Every branch below is gated by hidden-space/orbit state (via isNodeVisible/isOrbitVisible/
// isRelationshipVisible) — a hidden object falls through to the next branch exactly like a
// stale/deleted one, so toggling something invisible can never leave the camera pointed at it.
export function resolveCameraFocus(
  state: ModelState,
  projectId: string,
  resetViewToken: number,
  resetRequested: boolean,
  focusTarget: FocusTarget | null,
  focusRequested: boolean,
  hiddenSpaceIds: ReadonlySet<string>,
  hiddenOrbitIds: ReadonlySet<string>,
): CameraFocus {
  const spaceCount = spacesInProject(state, projectId).length;

  if (resetRequested) return defaultFocus(resetViewToken, projectId, spaceCount);

  if (focusRequested && focusTarget) {
    const explicit = resolveExplicitFocus(state, focusTarget, hiddenSpaceIds, hiddenOrbitIds);
    if (explicit) return explicit;
  }

  const tab = state.openTabs.find((t) => t.id === state.activeTabId);
  if (!tab) return defaultFocus(resetViewToken, projectId, spaceCount);

  if (tab.type === "node" && isNodeVisible(state, tab.id, hiddenSpaceIds, hiddenOrbitIds)) {
    return nodeFocus(state, tab.id);
  }

  if (tab.type === "orbit" && isOrbitVisible(state, tab.id, hiddenSpaceIds, hiddenOrbitIds)) {
    return orbitFocus(state, tab.id);
  }

  if (tab.type === "space" && state.spaces.has(tab.id) && isSpaceVisible(hiddenSpaceIds, tab.id)) {
    return spaceFocus(state, tab.id);
  }

  if (tab.type === "relationship" && isRelationshipVisible(state, tab.id, hiddenSpaceIds, hiddenOrbitIds)) {
    return relationshipFocus(state, tab.id);
  }

  return defaultFocus(resetViewToken, projectId, spaceCount);
}
