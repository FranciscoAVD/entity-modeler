import { create } from "zustand";

// Rendering-only visibility toggles — kept separate from the model store since
// hiding a space/orbit is a view concern, not a change to the underlying data (plan.md decision #5).
interface ViewState {
  hiddenSpaceIds: Set<string>;
  hiddenOrbitIds: Set<string>;
  toggleSpaceVisibility(id: string): void;
  toggleOrbitVisibility(id: string): void;
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
}));
