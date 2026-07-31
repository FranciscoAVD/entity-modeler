import { getOrbitWorldOrigin, getWorldPosition } from "@/store/selectors";
import type { ModelState } from "@/store/store";
import type { Vector3 } from "@/store/types";
import { computeOrbitRadius } from "./bounds";

export const DEFAULT_FOCUS_TARGET: Vector3 = { x: 0, y: 0, z: 0 };
export const DEFAULT_CAMERA_POSITION: Vector3 = { x: 18, y: 14, z: 22 };

const ENTITY_FOCUS_DISTANCE = 6;
const ORBIT_FOCUS_MARGIN = 3;
const ORBIT_FOCUS_RADIUS_FACTOR = 2.2;

function vectorLength(v: Vector3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

const DEFAULT_DISTANCE = vectorLength(DEFAULT_CAMERA_POSITION);

export interface CameraFocus {
  key: string;
  target: Vector3;
  distance: number;
}

function defaultFocus(resetViewToken: number): CameraFocus {
  return { key: `reset:${resetViewToken}`, target: DEFAULT_FOCUS_TARGET, distance: DEFAULT_DISTANCE };
}

// A reset request must win even while a tab is still active — otherwise the tab-focus
// branch below would keep re-selecting itself and "Reset view" would silently no-op.
// `resetRequested` is computed by the caller (CameraRig diffs resetViewToken against its
// previous value) since detecting "just changed" isn't something a pure function can do
// from a snapshot alone.
export function resolveCameraFocus(
  state: ModelState,
  resetViewToken: number,
  resetRequested: boolean,
): CameraFocus {
  if (resetRequested) return defaultFocus(resetViewToken);

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

  // Relationship tabs aren't renderable yet (Phase 4) — fall back to the overview.
  return defaultFocus(resetViewToken);
}
