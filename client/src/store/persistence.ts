import { useEffect } from "react";
import { shallow } from "zustand/shallow";
import { useViewStore } from "@/scene/viewStore";
import { saveProject } from "./api";
import { serializeProject } from "./serialize";
import { useModelStore } from "./store";

const SAVE_DEBOUNCE_MS = 1000;

// Debounced full-project autosave — subscribes to just the five data Maps (shallow-compared, so
// tab/selection-only changes don't trigger a save), and ~1s after the last edit, serializes and
// PUTs the whole project. The Zustand store stays the sole source of validation/cascade truth;
// this is a pure side effect layered on top, not a rearchitecture (plan.md decision #5).
export function useAutosave(projectId: string | null) {
  useEffect(() => {
    if (projectId === null) return;

    let timeout: ReturnType<typeof setTimeout> | undefined;

    const flush = () => {
      if (timeout === undefined) return;
      clearTimeout(timeout);
      timeout = undefined;
      const state = useModelStore.getState();
      useViewStore.getState().setSaveStatus("saving");
      saveProject(projectId, serializeProject(state, projectId))
        .then(() => useViewStore.getState().setSaveStatus("saved"))
        .catch((err) => {
          console.error(`Autosave failed for project ${projectId}`, err);
          useViewStore.getState().setSaveStatus("error");
        });
    };

    const unsubscribe = useModelStore.subscribe(
      (state) => [state.spaces, state.orbits, state.nodes, state.relationships, state.tags] as const,
      () => {
        if (timeout !== undefined) clearTimeout(timeout);
        timeout = setTimeout(flush, SAVE_DEBOUNCE_MS);
      },
      { equalityFn: shallow },
    );

    return () => {
      unsubscribe();
      // Don't drop an edit still waiting on the debounce when switching projects or unmounting.
      flush();
    };
  }, [projectId]);
}
