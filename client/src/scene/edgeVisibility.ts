import type { ModelState } from "@/store/store";
import { isEntityVisible } from "./visibility";

// An edge disappears if either endpoint's space or orbit has been toggled hidden. Visibility
// toggles live in viewStore, separate from the model store, so both hidden sets are passed in
// explicitly rather than read here.
export function isRelationshipVisible(
  state: ModelState,
  relationshipId: string,
  hiddenSpaceIds: ReadonlySet<string>,
  hiddenOrbitIds: ReadonlySet<string>,
): boolean {
  const relationship = state.relationships.get(relationshipId);
  if (!relationship) return false;
  return (
    isEntityVisible(state, relationship.sourceId, hiddenSpaceIds, hiddenOrbitIds) &&
    isEntityVisible(state, relationship.targetId, hiddenSpaceIds, hiddenOrbitIds)
  );
}
