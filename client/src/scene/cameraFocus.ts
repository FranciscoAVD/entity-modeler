import { length, midpoint, subtract } from "@/lib/vector3";
import { getOrbitWorldOrigin, getWorldPosition } from "@/store/selectors";
import type { ModelState } from "@/store/store";
import type { Vector3 } from "@/store/types";
import { computeOrbitRadius, computeSpaceRadius } from "./bounds";
import type { FocusTarget } from "./viewStore";

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

// Resolves a sidebar-driven focus request (space/orbit/entity), independent of tabs. Reuses the
// same key format as the tab-based branches below (`orbit:${id}`, `entity:${id}`) so refocusing
// an object that's also the active tab is a no-op rather than a redundant re-tween.
function resolveExplicitFocus(state: ModelState, target: FocusTarget): CameraFocus | null {
  if (target.type === "space" && state.spaces.has(target.id)) {
    const space = state.spaces.get(target.id)!;
    return {
      key: `space:${target.id}`,
      target: space.origin,
      distance: computeSpaceRadius(state, target.id) * SPACE_FOCUS_RADIUS_FACTOR + SPACE_FOCUS_MARGIN,
    };
  }

  if (target.type === "orbit" && state.orbits.has(target.id)) {
    return {
      key: `orbit:${target.id}`,
      target: getOrbitWorldOrigin(state, target.id),
      distance: computeOrbitRadius(state, target.id) * ORBIT_FOCUS_RADIUS_FACTOR + ORBIT_FOCUS_MARGIN,
    };
  }

  if (target.type === "entity" && state.entities.has(target.id)) {
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
export function resolveCameraFocus(
  state: ModelState,
  resetViewToken: number,
  resetRequested: boolean,
  focusTarget: FocusTarget | null,
  focusRequested: boolean,
): CameraFocus {
  if (resetRequested) return defaultFocus(resetViewToken);

  if (focusRequested && focusTarget) {
    const explicit = resolveExplicitFocus(state, focusTarget);
    if (explicit) return explicit;
  }

  const tab = state.openTabs.find((t) => t.id === state.activeTabId);
  if (!tab) return defaultFocus(resetViewToken);

  if (tab.type === "entity" && state.entities.has(tab.id)) {
    return {
      key: `entity:${tab.id}`,
      target: getWorldPosition(state, tab.id),
      distance: ENTITY_FOCUS_DISTANCE,
    };
  }

  if (tab.type === "orbit" && state.orbits.has(tab.id)) {
    return {
      key: `orbit:${tab.id}`,
      target: getOrbitWorldOrigin(state, tab.id),
      distance: computeOrbitRadius(state, tab.id) * ORBIT_FOCUS_RADIUS_FACTOR + ORBIT_FOCUS_MARGIN,
    };
  }

  if (tab.type === "relationship") {
    const relationship = state.relationships.get(tab.id);
    if (relationship && state.entities.has(relationship.sourceId) && state.entities.has(relationship.targetId)) {
      const sourcePos = getWorldPosition(state, relationship.sourceId);
      const targetPos = getWorldPosition(state, relationship.targetId);
      const edgeLength = length(subtract(targetPos, sourcePos));
      return {
        key: `relationship:${tab.id}`,
        target: midpoint(sourcePos, targetPos),
        distance: Math.max(RELATIONSHIP_FOCUS_MIN_DISTANCE, edgeLength * RELATIONSHIP_FOCUS_DISTANCE_FACTOR),
      };
    }
  }

  return defaultFocus(resetViewToken);
}
