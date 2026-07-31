import type { ModelState } from "@/store/store";

function isEntityVisible(
  state: ModelState,
  entityId: string,
  hiddenSpaceIds: ReadonlySet<string>,
  hiddenOrbitIds: ReadonlySet<string>,
): boolean {
  const entity = state.entities.get(entityId);
  if (!entity) return false;
  if (hiddenSpaceIds.has(entity.spaceId)) return false;
  if (entity.orbitId !== undefined && hiddenOrbitIds.has(entity.orbitId)) return false;
  return true;
}

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
