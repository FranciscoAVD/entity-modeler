import type { ModelState } from "@/store/store";

export function isSpaceVisible(hiddenSpaceIds: ReadonlySet<string>, spaceId: string): boolean {
  return !hiddenSpaceIds.has(spaceId);
}

// An orbit disappears if it's hidden directly, or if its parent space is — hiding a space
// cascades to everything nested inside it (OrbitBoundary only renders as a child of
// SpaceBoundary's own JSX, so a hidden space already takes its orbits down with it visually;
// this mirrors that for anything, like focus resolution, that isn't going through rendering).
export function isOrbitVisible(
  state: ModelState,
  orbitId: string,
  hiddenSpaceIds: ReadonlySet<string>,
  hiddenOrbitIds: ReadonlySet<string>,
): boolean {
  const orbit = state.orbits.get(orbitId);
  if (!orbit) return false;
  if (hiddenOrbitIds.has(orbitId)) return false;
  return isSpaceVisible(hiddenSpaceIds, orbit.spaceId);
}

export function isEntityVisible(
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
