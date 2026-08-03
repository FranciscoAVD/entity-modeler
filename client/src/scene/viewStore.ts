import { create } from "zustand";

export type FocusableType = "space" | "orbit" | "entity" | "relationship";

export interface FocusTarget {
  id: string;
  type: FocusableType;
}

// Rendering-only visibility toggles — kept separate from the model store since
// hiding a space/orbit is a view concern, not a change to the underlying data (plan.md decision #5).
interface ViewState {
  hiddenSpaceIds: Set<string>;
  hiddenOrbitIds: Set<string>;
  toggleSpaceVisibility(id: string): void;
  toggleOrbitVisibility(id: string): void;
  // Incremented to request a camera fly-to-overview independent of tab state (plan.md's "reset view" control).
  resetViewToken: number;
  requestResetView(): void;
  // Camera focus independent of tab/selection state — moves the camera without opening the
  // details panel. Driven by a single click on an object (in the 3D scene or the sidebar);
  // opening the panel itself now requires a double-click (3D scene) or the "View notes" context
  // menu item (sidebar) instead, both of which go through openTab. focusToken lets CameraRig
  // detect "just requested" even when re-focusing the same id.
  focusTarget: FocusTarget | null;
  focusToken: number;
  focusOn(id: string, type: FocusableType): void;
}

function toggle(set: Set<string>, id: string): Set<string> {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export const useViewStore = create<ViewState>()((set, get) => ({
  hiddenSpaceIds: new Set(),
  hiddenOrbitIds: new Set(),

  toggleSpaceVisibility(id) {
    set({ hiddenSpaceIds: toggle(get().hiddenSpaceIds, id) });
  },

  toggleOrbitVisibility(id) {
    set({ hiddenOrbitIds: toggle(get().hiddenOrbitIds, id) });
  },

  resetViewToken: 0,

  requestResetView() {
    set({ resetViewToken: get().resetViewToken + 1 });
  },

  focusTarget: null,
  focusToken: 0,

  focusOn(id, type) {
    set({ focusTarget: { id, type }, focusToken: get().focusToken + 1 });
  },
}));
