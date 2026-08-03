import { length, midpoint, subtract } from "@/lib/vector3";
import { getOrbitWorldOrigin, getWorldPosition } from "@/store/selectors";
import type { ModelState } from "@/store/store";
import type { Vector3 } from "@/store/types";
import { computeOrbitRadius, computeSpaceRadius } from "./bounds";
import { isRelationshipVisible } from "./edgeVisibility";
import type { FocusTarget } from "./viewStore";
import { isEntityVisible, isOrbitVisible, isSpaceVisible } from "./visibility";

export const DEFAULT_FOCUS_TARGET: Vector3 = { x: 0, y: 0, z: 0 };
export const DEFAULT_CAMERA_POSITION: Vector3 = { x: 18, y: 14, z: 22 };

const ENTITY_FOCUS_DISTANCE = 6;
const ORBIT_FOCUS_MARGIN = 3;
const ORBIT_FOCUS_RADIUS_FACTOR = 2.2;
const SPACE_FOCUS_MARGIN = 4;
const SPACE_FOCUS_RADIUS_FACTOR = 1.6;
const RELATIONSHIP_FOCUS_MIN_DISTANCE = 8;
const RELATIONSHIP_FOCUS_DISTANCE_FACTOR = 1.1;

const DEFAULT_DISTANCE = length(DEFAULT_CAMERA_POSITION);

export interface CameraFocus {
  key: string;
  target: Vector3;
  distance: number;
}

function defaultFocus(resetViewToken: number): CameraFocus {
  return { key: `reset:${resetViewToken}`, target: DEFAULT_FOCUS_TARGET, distance: DEFAULT_DISTANCE };
}

// Shared by the sidebar-driven explicit-focus branch and the space-tab branch below — both
// need the identical key/target/distance once a space is confirmed to exist and be visible.
function spaceFocus(state: ModelState, spaceId: string): CameraFocus {
  return {
    key: `space:${spaceId}`,
    target: state.spaces.get(spaceId)!.origin,
    distance: computeSpaceRadius(state, spaceId) * SPACE_FOCUS_RADIUS_FACTOR + SPACE_FOCUS_MARGIN,
  };
}

// Resolves a sidebar-driven focus request (space/orbit/entity), independent of tabs. Reuses the
// same key format as the tab-based branches below (`orbit:${id}`, `entity:${id}`) so refocusing
// an object that's also the active tab is a no-op rather than a redundant re-tween. A hidden
// target resolves to null (falls through to the tab/default branches) — there's nothing
// rendered to fly to, so focusing it would just point the camera at empty space.
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
    return {
      key: `orbit:${target.id}`,
      target: getOrbitWorldOrigin(state, target.id),
      distance: computeOrbitRadius(state, target.id) * ORBIT_FOCUS_RADIUS_FACTOR + ORBIT_FOCUS_MARGIN,
    };
  }

  if (target.type === "entity" && isEntityVisible(state, target.id, hiddenSpaceIds, hiddenOrbitIds)) {
    return {
      key: `entity:${target.id}`,
      target: getWorldPosition(state, target.id),
      distance: ENTITY_FOCUS_DISTANCE,
    };
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
// Every branch below is gated by hidden-space/orbit state (via isEntityVisible/isOrbitVisible/
// isRelationshipVisible) — a hidden object falls through to the next branch exactly like a
// stale/deleted one, so toggling something invisible can never leave the camera pointed at it.
export function resolveCameraFocus(
  state: ModelState,
  resetViewToken: number,
  resetRequested: boolean,
  focusTarget: FocusTarget | null,
  focusRequested: boolean,
  hiddenSpaceIds: ReadonlySet<string>,
  hiddenOrbitIds: ReadonlySet<string>,
): CameraFocus {
  if (resetRequested) return defaultFocus(resetViewToken);

  if (focusRequested && focusTarget) {
    const explicit = resolveExplicitFocus(state, focusTarget, hiddenSpaceIds, hiddenOrbitIds);
    if (explicit) return explicit;
  }

  const tab = state.openTabs.find((t) => t.id === state.activeTabId);
  if (!tab) return defaultFocus(resetViewToken);

  if (tab.type === "entity" && isEntityVisible(state, tab.id, hiddenSpaceIds, hiddenOrbitIds)) {
    return {
      key: `entity:${tab.id}`,
      target: getWorldPosition(state, tab.id),
      distance: ENTITY_FOCUS_DISTANCE,
    };
  }

  if (tab.type === "orbit" && isOrbitVisible(state, tab.id, hiddenSpaceIds, hiddenOrbitIds)) {
    return {
      key: `orbit:${tab.id}`,
      target: getOrbitWorldOrigin(state, tab.id),
      distance: computeOrbitRadius(state, tab.id) * ORBIT_FOCUS_RADIUS_FACTOR + ORBIT_FOCUS_MARGIN,
    };
  }

  if (tab.type === "space" && state.spaces.has(tab.id) && isSpaceVisible(hiddenSpaceIds, tab.id)) {
    return spaceFocus(state, tab.id);
  }

  if (tab.type === "relationship" && isRelationshipVisible(state, tab.id, hiddenSpaceIds, hiddenOrbitIds)) {
    const relationship = state.relationships.get(tab.id)!;
    const sourcePos = getWorldPosition(state, relationship.sourceId);
    const targetPos = getWorldPosition(state, relationship.targetId);
    const edgeLength = length(subtract(targetPos, sourcePos));
    return {
      key: `relationship:${tab.id}`,
      target: midpoint(sourcePos, targetPos),
      distance: Math.max(RELATIONSHIP_FOCUS_MIN_DISTANCE, edgeLength * RELATIONSHIP_FOCUS_DISTANCE_FACTOR),
    };
  }

  return defaultFocus(resetViewToken);
}
