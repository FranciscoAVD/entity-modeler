import { entitiesInOrbit, entitiesInSpace, orbitsInSpace } from "@/store/selectors";
import type { ModelState } from "@/store/store";
import type { Vector3 } from "@/store/types";

// Never render a group too small to see or click, per plan.md's empty-state rule.
export const MIN_BOUNDARY_RADIUS = 2;
const BOUNDARY_PADDING = 1.5;

function length(v: Vector3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

function radiusForPoints(points: Vector3[]): number {
  if (points.length === 0) return MIN_BOUNDARY_RADIUS;
  const farthest = Math.max(...points.map(length));
  return Math.max(MIN_BOUNDARY_RADIUS, farthest + BOUNDARY_PADDING);
}

// A space's boundary must contain its orbits (as nested spheres) and any ungrouped entities.
export function computeSpaceRadius(state: ModelState, spaceId: string): number {
  const orbitPoints = orbitsInSpace(state, spaceId).map((o) => o.origin);
  const ungroupedPoints = entitiesInSpace(state, spaceId)
    .filter((e) => e.orbitId === undefined)
    .map((e) => e.position);
  return radiusForPoints([...orbitPoints, ...ungroupedPoints]);
}

export function computeOrbitRadius(state: ModelState, orbitId: string): number {
  return radiusForPoints(entitiesInOrbit(state, orbitId).map((e) => e.position));
}

// A space with an (even empty) orbit is still visually populated by that orbit's sphere.
export function isSpaceEmpty(state: ModelState, spaceId: string): boolean {
  const hasOrbits = orbitsInSpace(state, spaceId).length > 0;
  const hasUngroupedEntities = entitiesInSpace(state, spaceId).some((e) => e.orbitId === undefined);
  return !hasOrbits && !hasUngroupedEntities;
}

export function isOrbitEmpty(state: ModelState, orbitId: string): boolean {
  return entitiesInOrbit(state, orbitId).length === 0;
}
