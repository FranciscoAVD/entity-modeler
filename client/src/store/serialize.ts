import type { ProjectDetail } from "shared";
import {
  nodesInProject,
  orbitsInProject,
  relationshipsInProject,
  spacesInProject,
  tagsInProject,
} from "./selectors";
import type { ModelState } from "./store";

// The inverse of store.ts's hydrateProject — pulls each of the five flat Maps down to just this
// project's own records (via the same "in project" selectors the rest of the app already uses, no
// new query logic) for a PUT /projects/:id upsert. Flat, not nested — the wire shape mirrors how
// both the client's store and the server's SQL schema already store this data (see
// ProjectDetailSchema's own comment in shared/schemas.ts). Used by the Layer 5 autosave
// subscription.
export function serializeProject(state: ModelState, projectId: string): ProjectDetail {
  const project = state.projects.get(projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);

  return {
    project,
    spaces: spacesInProject(state, projectId),
    orbits: orbitsInProject(state, projectId),
    nodes: nodesInProject(state, projectId),
    relationships: relationshipsInProject(state, projectId),
    tags: tagsInProject(state, projectId),
  };
}
