import type { ProjectDetail } from "shared";
import {
  nodesInOrbit,
  orbitsInSpace,
  relationshipsInProject,
  spacesInProject,
  tagsInProject,
  ungroupedNodesInSpace,
} from "./selectors";
import type { ModelState } from "./store";

// The inverse of store.ts's hydrateProject — walks the flat Maps (via the same "children of X"
// selectors the rest of the app already uses, no new query logic) back into the nested tree shape
// the server expects for a PUT /projects/:id upsert. Used by the Layer 5 autosave subscription.
export function serializeProject(state: ModelState, projectId: string): ProjectDetail {
  const project = state.projects.get(projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);

  const spaces = spacesInProject(state, projectId).map((space) => ({
    ...space,
    orbits: orbitsInSpace(state, space.id).map((orbit) => ({
      ...orbit,
      nodes: nodesInOrbit(state, orbit.id),
    })),
    ungroupedNodes: ungroupedNodesInSpace(state, space.id),
  }));

  return {
    project,
    spaces,
    relationships: relationshipsInProject(state, projectId),
    tags: tagsInProject(state, projectId),
  };
}
